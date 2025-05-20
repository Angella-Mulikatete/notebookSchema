import { internalAction, internalMutation, mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { FilterBuilder } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const EMBEDDING_MODEL = "text-embedding-004";
const MAX_CONTEXT_CHUNKS = 5;
const MAX_CHUNK_TEXT_LENGTH = 700; // Max characters per chunk to keep context concise

async function getAuthenticatedUserId(ctx: QueryCtx | MutationCtx | ActionCtx ) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId;
}

export const createDocument = mutation({
  args: {
    fileName: v.string(),
    textContent: v.string(),
    type: v.union(v.literal("pdf"), v.literal("txt"), v.literal("gdoc"), v.literal("url")),
    fileUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const documentId = await ctx.db.insert("documents", {
      userId,
      fileName: args.fileName,
      textContent: args.textContent,
      type: args.type,
      fileUrl: args.fileUrl,
      status: "processing",
    });
    await ctx.scheduler.runAfter(0, internal.documents.processDocumentContent, { documentId });
    return documentId;
  },
});

export const updateDocument = mutation({
  args: {
    documentId: v.id("documents"),
    fileName: v.optional(v.string()),
    textContent: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const document = await ctx.db.get(args.documentId);

    if (!document) throw new Error("Document not found");
    if (document.userId !== userId) throw new Error("Not authorized to update this document");

    const updates: Partial<Doc<"documents">> = {};
    if (args.fileName !== undefined) updates.fileName = args.fileName;
    if (args.textContent !== undefined) updates.textContent = args.textContent;
    if (args.status !== undefined) updates.status = args.status;
    await ctx.db.patch(args.documentId, updates);
  },
});

export const deleteDocument = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");
    if (document.userId !== userId) throw new Error("Not authorized to delete this document");
    
    const chunks = await ctx.db.query("chunks")
      .withIndex("by_userId_and_documentId", q => q.eq("userId", userId).eq("documentId", args.documentId))
      .collect();
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    const knowledgeEntries = await ctx.db.query("knowledgeEntries")
      .withIndex("by_documentId", q => q.eq("documentId", args.documentId))
      .collect();
    for (const entry of knowledgeEntries) {
      await ctx.db.delete(entry._id);
    }
    
    await ctx.db.delete(args.documentId);
  },
});

export const listDocuments = query({
  args: {
    status: v.optional(v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    let queryBuilder = ctx.db.query("documents")
      .withIndex("by_userId_and_status", q => q.eq("userId", userId));

    if (args.status) {
      queryBuilder = ctx.db.query("documents")
        .withIndex("by_userId_and_status", q => q.eq("userId", userId).eq("status", args.status!));
    }
    
    return await queryBuilder.order("desc").collect();
  },
});

export const getDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");
    if (document.userId !== userId) throw new Error("Not authorized to view this document");
    return document;
  },
});

export const processDocumentContent = internalAction({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document : Doc<"documents"> | null = await ctx.runQuery(internal.documents.getDocumentForProcessing, { documentId: args.documentId });
    if (!document || document.status !== "processing") {
      console.log(`Document ${args.documentId} not found or not in processing state for processDocumentContent action.`);
      if (document && (document.status === "ready" || document.status === "failed")) {
        return;
      }
      if (!document) {
        console.error(`Document ${args.documentId} is null, cannot update status.`);
        return;
      }
      await ctx.runMutation(internal.documents.updateDocumentStatus, {
        documentId: document._id,
        status: "failed",
        errorMessage: "Document not found or not in processing state at action start."
      });
      return;
    }

    const apiKey = process.env.CONVEX_GEMINI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.documents.updateDocumentStatus, {
        documentId: document._id,
        status: "failed",
        errorMessage: "CONVEX_GEMINI_API_KEY environment variable not set."
      });
      throw new Error("CONVEX_GEMINI_API_KEY environment variable not set.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

    const rawChunks: string[] = document.textContent.split(/\n+/).flatMap(paragraph => {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      return sentences.flatMap(sentence => {
        const words = sentence.split(/\s+/);
        const subChunks: string[] = [];
        let currentChunk = "";
        for (const word of words) {
          if ((currentChunk + " " + word).length > MAX_CHUNK_TEXT_LENGTH) {
            if (currentChunk) subChunks.push(currentChunk.trim());
            currentChunk = word;
          } else {
            currentChunk = currentChunk ? currentChunk + " " + word : word;
          }
        }
        if (currentChunk) subChunks.push(currentChunk.trim());
        return subChunks;
      });
    }).filter(chunk => chunk.trim().length > 10); 


    if (rawChunks.length === 0 && document.textContent.trim().length > 0) {
        if (document.textContent.length <= MAX_CHUNK_TEXT_LENGTH * 1.5) { 
            rawChunks.push(document.textContent.trim());
        } else {
            rawChunks.push(document.textContent.substring(0, MAX_CHUNK_TEXT_LENGTH).trim());
        }
    }
    
    if (rawChunks.length === 0) {
        console.log(`No processable chunks found for document ${document._id}. Content was: "${document.textContent.substring(0,100)}..."`);
        await ctx.runMutation(internal.documents.updateDocumentStatus, {
            documentId: document._id,
            status: "ready", 
            errorMessage: "No processable content found in document."
        });
        return;
    }

    try {
      for (const text of rawChunks) {
        if (!text.trim()) continue; 

        const embeddingResponse = await embeddingModel.embedContent(text);
        const embedding = embeddingResponse.embedding.values;

        const chunkId = await ctx.runMutation(internal.documents.addChunk, {
          userId: document.userId,
          documentId: document._id,
          text,
          embedding,
        });
        
        await ctx.runMutation(internal.documents.addKnowledgeEntry, {
          documentId: document._id,
          chunkId: chunkId.toString(), 
          summary: `Summary of: ${text.substring(0, Math.min(text.length, 50))}...`, 
          facts: [`Fact about: ${text.substring(0, Math.min(text.length, 30))}...`], 
          questions: [`What is ${text.substring(0, Math.min(text.length, 20))}...?`], 
        });
      }
      await ctx.runMutation(internal.documents.updateDocumentStatus, {
        documentId: document._id,
        status: "ready",
      });
    } catch (error: any) {
      console.error(`Failed to process document content for ${document._id}:`, error);
      await ctx.runMutation(internal.documents.updateDocumentStatus, {
        documentId: document._id,
        status: "failed",
        errorMessage: error?.message ?? "Unknown error during processing"
      });
    }
  }
});

export const getDocumentForProcessing = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx: QueryCtx, args: { documentId: Id<"documents"> }) => {
    return await ctx.db.get(args.documentId);
  }
});

export const addChunk = internalMutation({
  args: {
    userId: v.id("users"),
    documentId: v.id("documents"),
    text: v.string(),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chunks", {
      userId: args.userId,
      documentId: args.documentId,
      text: args.text,
      embedding: args.embedding,
    });
  },
});

export const addKnowledgeEntry = internalMutation({
  args: {
    documentId: v.id("documents"),
    chunkId: v.string(), 
    summary: v.string(),
    facts: v.array(v.string()),
    questions: v.array(v.string()),
    embeddings: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("knowledgeEntries", {
      documentId: args.documentId,
      chunkId: args.chunkId,
      summary: args.summary,
      facts: args.facts,
      questions: args.questions,
      embeddings: args.embeddings, 
    });
  },
});

export const updateDocumentStatus = internalMutation({
  args: { 
    documentId: v.id("documents"), 
    status: v.string(), 
    errorMessage: v.optional(v.string()),
  }, 
  handler: async (ctx, args) => {
    const validStatuses = ["processing", "ready", "failed"];
    if (!validStatuses.includes(args.status)) {
        console.error(`Invalid status update: ${args.status} for document ${args.documentId}`);
        return; 
    }
    const updatePayload: Partial<Doc<"documents">> = { status: args.status as Doc<"documents">["status"] };
    if (args.errorMessage) {
      console.error(`Document ${args.documentId} status updated to ${args.status} with error: ${args.errorMessage}`);
    }
    await ctx.db.patch(args.documentId, updatePayload);
  }
});

export const searchChunksForContext = internalQuery({
  args: {
    userId: v.id("users"),
    queryEmbedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Fetch all chunks for the user
    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_userId", q => q.eq("userId", args.userId))
      .collect();

    // Compute cosine similarity for each chunk
    function cosineSimilarity(a: number[], b: number[]) {
      const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
      const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
      const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
      return dot / (normA * normB);
    }

    const scored = chunks
      .map(chunk => ({
        ...chunk,
        _score: cosineSimilarity(args.queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, args.limit ?? MAX_CONTEXT_CHUNKS);

    return scored.map(chunk => chunk.text).join("\n\n---\n\n");
  }
});
