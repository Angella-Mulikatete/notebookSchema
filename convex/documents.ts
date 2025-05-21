import { internalAction, internalMutation, mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { FilterBuilder } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

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
    status: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    ),
    storageId: v.optional(v.id("_storage")), 
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const documentId = await ctx.db.insert("documents", {
      userId,
      fileName: args.fileName,
      textContent: (args.type === "txt" || args.type === "url") ? args.textContent : undefined,  //will be populated during processing
      type: args.type,
      fileUrl: args.fileUrl,
      status: args.status,
      storageId: args.storageId,
    });
    await ctx.scheduler.runAfter(0, internal.documentProcessing.processDocumentContent, { documentId });
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

// export const processDocumentContent = internalAction({
//   args: { documentId: v.id("documents") },
//   handler: async (ctx, args) => {

//     //get the doc
//     const document : Doc<"documents"> | null = await ctx.runQuery(internal.documents.getDocumentForProcessing, { documentId: args.documentId });
//     if (!document) throw new Error("Document not found");

//     // Check if fileUrl exists before fetching
//     if (!document.fileUrl) {
//       console.error(`Document ${document._id} is missing fileUrl, cannot process.`);
//       await ctx.runMutation(internal.documents.updateDocumentStatus, {
//         documentId: document._id,
//         status: "failed",
//         errorMessage: "Document is missing file URL."
//       });
//       return; // Stop processing if fileUrl is missing
//     }

//     //download the file from the cloudinary
//     const response = await fetch(document.fileUrl);
//     if(!response.ok) throw new Error(`Failed to fetch document content from cloudinary: ${response.statusText}`);
//     const buffer = await response.arrayBuffer();

//     let textContent = "";
    
//     //extract text based on file type
//     try{
//       if (document.type === "pdf") {
//         const pdf = await pdfParse(Buffer.from(buffer));
//         textContent = pdf.text;
//         // const text = await pdf.getTextContent();
//         // textContent = text.items.map((item: any) => item.str).join(" ");
//       } else if (document.type === "txt") {
//         // textContent = new TextDecoder().decode(buffer);
//          textContent = Buffer.from(buffer).toString("utf-8");
//       } else if (document.type === "gdoc") {
//         // const gdoc = new TextDecoder().decode(buffer);
//         // textContent = gdoc;
//         const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
//         textContent = result.value;
//       } else if (document.type === "url") {
//         textContent = new TextDecoder().decode(buffer);
//       }else {
//         textContent = "[Unsupported file type]";
//       }
//     } catch(err){
//       textContent = "Error extracting text"
//     }


// //update the doc with extracted text and status
    
//     // if (!document || document.status !== "processing") {
//     //   console.log(`Document ${args.documentId} not found or not in processing state for processDocumentContent action.`);
//     //   if (document && (document.status === "ready" || document.status === "failed")) {
//     //     return;
//     //   }
//     //   if (!document) {
//     //     console.error(`Document ${args.documentId} is null, cannot update status.`);
//     //     return;
//     //   }
//     //   await ctx.runMutation(internal.documents.updateDocumentStatus, {
//     //     documentId: document._id,
//     //     status: "failed",
//     //     errorMessage: "Document not found or not in processing state at action start."
//     //   });
//     //   return;
//     // }

    

//     const apiKey = process.env.CONVEX_GEMINI_API_KEY;
//     if (!apiKey) {
//       await ctx.runMutation(internal.documents.updateDocumentStatus, {
//         documentId: document._id,
//         status: "failed",
//         errorMessage: "CONVEX_GEMINI_API_KEY environment variable not set."
//       });
//       throw new Error("CONVEX_GEMINI_API_KEY environment variable not set.");
//     }
//     const genAI = new GoogleGenerativeAI(apiKey);
//     const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

//     const rawChunks: string[] = document.textContent.split(/\n+/).flatMap(paragraph => {
//       const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
//       return sentences.flatMap(sentence => {
//         const words = sentence.split(/\s+/);
//         const subChunks: string[] = [];
//         let currentChunk = "";
//         for (const word of words) {
//           if ((currentChunk + " " + word).length > MAX_CHUNK_TEXT_LENGTH) {
//             if (currentChunk) subChunks.push(currentChunk.trim());
//             currentChunk = word;
//           } else {
//             currentChunk = currentChunk ? currentChunk + " " + word : word;
//           }
//         }
//         if (currentChunk) subChunks.push(currentChunk.trim());
//         return subChunks;
//       });
//     }).filter(chunk => chunk.trim().length > 10);


//     if (rawChunks.length === 0 && document.textContent.trim().length > 0) {
//         // If initial chunking failed but textContent is not empty, add the whole trimmed text as one chunk
//         rawChunks.push(document.textContent.trim());
//     }

//     if (rawChunks.length === 0) {
//         console.log(`No processable chunks found for document ${document._id}. Content was: "${document.textContent.substring(0,100)}..."`);
//         await ctx.runMutation(internal.documents.updateDocumentStatus, {
//             documentId: document._id,
//             status: "ready",
//             errorMessage: "No processable content found in document."
//         });
//         return;
//     }

//     try {
//       for (const text of rawChunks) {
//         if (!text.trim()) continue;

//         const embeddingResponse = await embeddingModel.embedContent(text);
//         const embedding = embeddingResponse.embedding.values;

//         const chunkId = await ctx.runMutation(internal.documents.addChunk, {
//           userId: document.userId,
//           documentId: document._id,
//           text,
//           embedding,
//         });
        
//         await ctx.runMutation(internal.documents.addKnowledgeEntry, {
//           documentId: document._id,
//           chunkId: chunkId.toString(), 
//           summary: `Summary of: ${text.substring(0, Math.min(text.length, 50))}...`, 
//           facts: [`Fact about: ${text.substring(0, Math.min(text.length, 30))}...`], 
//           questions: [`What is ${text.substring(0, Math.min(text.length, 20))}...?`], 
//         });
//       }
//       await ctx.runMutation(internal.documents.updateDocumentStatus, {
//         documentId: document._id,
//         status: "ready",
//       });
//     } catch (error: any) {
//       console.error(`Failed to process document content for ${document._id}:`, error);
//       await ctx.runMutation(internal.documents.updateDocumentStatus, {
//         documentId: document._id,
//         status: "failed",
//         errorMessage: error?.message ?? "Unknown error during processing"
//       });
//     }
//   }
// });

export const getDocumentForProcessing = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx: QueryCtx, args: { documentId: Id<"documents"> }) => {
    return await ctx.db.get(args.documentId);
  }
});

export const callLLM = internalAction({
  args: {
    prompt: v.string(),
    systemMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.CONVEX_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("CONVEX_GEMINI_API_KEY environment variable not set.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", systemInstruction: args.systemMessage });

    const result = await model.generateContent(args.prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error("LLM did not return any text content.");
    }

    return text;
  },
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

export const updateDocumentTextContent = internalMutation({
    args: {
        documentId: v.id("documents"),
        textContent: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.documentId, {
            textContent: args.textContent,
            updatedAt: Date.now(), // Also update timestamp here
        });
    },
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


//generare a presigned url for file upload
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // Generate the upload URL from Convex Storage
    return await ctx.storage.generateUploadUrl();
  },
});

// Link a document to a notebook
export const linkDocumentToNotebook = mutation({
  args: {
    documentId: v.id("documents"),
    notebookId: v.id("notebooks"),
  },
  handler: async (ctx, args) => {
     const userId = await getAuthenticatedUserId(ctx);
    
    // Check if document exists and belongs to user
    const document = await ctx.db.get(args.documentId);
    if (!document || document.userId !== userId) {
      throw new Error("Document not found or access denied");
    }
    
    // Check if notebook exists and belongs to user
    const notebook = await ctx.db.get(args.notebookId);
    if (!notebook || notebook.userId !== userId) {
      throw new Error("Notebook not found or access denied");
    }
    
    // Create the link
    return await ctx.db.insert("documentNotebookLinks", {
      documentId: args.documentId,
      notebookId: args.notebookId,
      userId: userId,
    });
  },
});


//generate content based on selected docs
export const generateContent = internalAction({
  args: {
    notebookId: v.id("notebooks"),
    documentIds: v.array(v.id("documents")),
    contentType: v.union(
      v.literal("study_guide"),
      v.literal("faq"),
      v.literal("briefing_doc"),
      v.literal("timeline")
    ),
  },
  handler: async (ctx, args): Promise<Id<"generatedContent">> => {
    const userId = await getAuthenticatedUserId(ctx);

    // Verify notebook ownership and fetch document contents
    const { notebook, documentContents }: { notebook: Doc<"notebooks"> | null, documentContents: DocumentContent[] } = await ctx.runQuery(internal.documents.getDocumentsAndKnowledgeForGeneration, {
      notebookId: args.notebookId,
      documentIds: args.documentIds,
      userId,
    });

    // Generate appropriate content based on contentType
    let generatedContent = "";
    const title: string = `${args.contentType.replace('_', ' ').toUpperCase()} for ${notebook.title}`; // Use non-null assertion as notebook is checked in getDocumentsAndKnowledgeForGeneration

    switch (args.contentType) {
      case "study_guide":
        generatedContent = await generateStudyGuide(ctx, documentContents);
        break;
      case "faq":
        generatedContent = await generateFAQ(ctx, documentContents);
        break;
      case "briefing_doc":
        generatedContent = await generateBriefingDoc(ctx, documentContents);
        break;
      case "timeline":
        generatedContent = await generateTimeline(ctx, documentContents);
        break;
    }

    // Store the generated content
    const contentId: Id<"generatedContent"> = await ctx.runMutation(internal.documents.storeGeneratedContent, {
      notebookId: args.notebookId,
      userId,
      title,
      contentType: args.contentType,
      content: generatedContent,
      sourceDocuments: args.documentIds,
    });

    return contentId;
  },
});

// Get the necessary documents, chunks, and knowledge entries for content generation
export const getDocumentsAndKnowledgeForGeneration = internalQuery({
  args: {
    notebookId: v.id("notebooks"),
    documentIds: v.array(v.id("documents")),
    userId: v.id("users"),
  },
  handler: async (ctx: QueryCtx, args) => {
    // Verify notebook ownership
    const notebook = await ctx.db.get(args.notebookId);
    if (!notebook || notebook.userId !== args.userId) {
      throw new Error("Notebook not found or access denied");
    }

    // Verify document ownership and status, and fetch related data
    const documentContents = [];
    for (const docId of args.documentIds) {
      const doc = await ctx.db.get(docId);
      if (!doc || doc.userId !== args.userId) {
        throw new Error(`Document ${docId} not found or access denied`);
      }

      // Get chunks for this document
      const chunks = await ctx.db
        .query("chunks")
        .withIndex("by_userId_and_documentId", q =>
          q.eq("userId", args.userId).eq("documentId", docId)
        )
        .collect();

      // Get knowledge entries for this document
      const knowledgeEntries = await ctx.db
        .query("knowledgeEntries")
        .withIndex("by_documentId", q => q.eq("documentId", docId))
        .collect();

      documentContents.push({
        document: doc,
        chunks,
        knowledgeEntries,
      });
    }

    return { notebook, documentContents };
  }
});

// Store the generated content in the database
export const storeGeneratedContent = internalMutation({
  args: {
    notebookId: v.id("notebooks"),
    userId: v.id("users"),
    title: v.string(),
    contentType: v.union(
      v.literal("study_guide"),
      v.literal("faq"),
      v.literal("briefing_doc"),
      v.literal("timeline")
    ),
    content: v.string(),
    sourceDocuments: v.array(v.id("documents")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("generatedContent", {
      notebookId: args.notebookId,
      userId: args.userId,
      title: args.title,
      contentType: args.contentType,
      content: args.content,
      sourceDocuments: args.sourceDocuments,
      creationDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    });
  }
});


// Get the latest generated content of a specific type for a notebook
export const getLatestGeneratedContent = query({
  args: {
    notebookId: v.id("notebooks"),
    contentType: v.optional(v.union(
      v.literal("study_guide"),
      v.literal("faq"),
      v.literal("briefing_doc"),
      v.literal("timeline")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);

    // Build the query
    const contentQuery = ctx.db
      .query("generatedContent")
      .withIndex("by_notebookId", q => q.eq("notebookId", args.notebookId));

    // Get all matching content, sorted by creation date
    const contents = await contentQuery.collect();

    // Filter by user ID and contentType (if provided), and sort by creation date (newest first)
    const userContents = contents
      .filter(content => content.userId === userId && (!args.contentType || content.contentType === args.contentType))
      .sort((a, b) => new Date(b.creationDate as string).getTime() - new Date(a.creationDate as string).getTime()); // Explicitly cast to string and use getTime() for sorting

    // Return the most recent content, or null if none exists
  return userContents.length > 0 ? userContents[0] : null;
  },
});

type DocumentContent = {
  document: Doc<"documents">;
  chunks: Doc<"chunks">[];
  knowledgeEntries: Doc<"knowledgeEntries">[];
};

async function generateStudyGuide(ctx: ActionCtx, documentContents: DocumentContent[]): Promise<string> {
  // 1. Prepare context for the LLM
  const context = documentContents.map(doc =>
    `Document: ${doc.document.fileName}\n` +
    doc.knowledgeEntries.map((entry, idx) =>
      `Entry ${idx + 1}:\nSummary: ${entry.summary}\nFacts: ${entry.facts.join("; ")}\nQuestions: ${entry.questions.join("; ")}`
    ).join("\n")
  ).join("\n\n");

  // 2. Craft a detailed prompt
  const prompt = `
You are an expert educator. Given the following extracted knowledge from several documents, write a comprehensive study guide in Markdown format. Include:

- A "Key Concepts" section summarizing the most important facts.
- A "Study Questions" section with challenging questions for review.
- Clearly indicate which document each concept/question comes from.

Here is the knowledge extracted from the documents:

${context}
`;

  // 3. Call the LLM
  return await ctx.runAction(internal.documents.callLLM, {
    prompt,
    systemMessage: "You generate clear, concise study guides for students.",
  });
}

async function generateFAQ(ctx: ActionCtx, documentContents: DocumentContent[]): Promise<string> {
  const context = documentContents.map(doc =>
    `Document: ${doc.document.fileName}\n` +
    doc.knowledgeEntries.map((entry, idx) =>
      `Entry ${idx + 1}:\nFacts: ${entry.facts.join("; ")}\nQuestions: ${entry.questions.join("; ")}`
    ).join("\n")
  ).join("\n\n");

  const prompt = `
Given the following extracted facts and questions from several documents, write a Frequently Asked Questions (FAQ) section in Markdown. For each question, provide a clear, detailed answer based on the facts. Group questions by document.

Extracted data:
${context}
`;

  return await ctx.runAction(internal.documents.callLLM, {
    prompt,
    systemMessage: "You are an expert at writing helpful FAQs.",
  });
}

async function generateBriefingDoc(ctx: ActionCtx, documentContents: DocumentContent[]): Promise<string> {
  const context = documentContents.map(doc =>
    `Document: ${doc.document.fileName}\n` +
    doc.knowledgeEntries.map((entry, idx) =>
      `Entry ${idx + 1}:\nSummary: ${entry.summary}\nFacts: ${entry.facts.join("; ")}`
    ).join("\n")
  ).join("\n\n");

  const prompt = `
You are a business analyst. Write an executive briefing document in Markdown format based on the following document summaries and facts. Include:

- A "Summary" section with an overview.
- "Key Points" for each document.
- "Recommendations" based on the key findings.

Extracted information:
${context}
`;

  return await ctx.runAction(internal.documents.callLLM, {
    prompt,
    systemMessage: "You write concise, actionable executive briefings.",
  });
}


async function generateTimeline(ctx: ActionCtx, documentContents: DocumentContent[]): Promise<string> {
  const context = documentContents.map(doc =>
    `Document: ${doc.document.fileName}\n` +
    doc.knowledgeEntries.map((entry, idx) =>
      `Entry ${idx + 1}:\nFacts: ${entry.facts.join("; ")}`
    ).join("\n")
  ).join("\n\n");

  const prompt = `
Given the following facts from several documents, extract any events with dates or temporal information. Create a chronological timeline in Markdown, grouping events by date. If no explicit dates are found, infer a logical order based on the content.

Extracted facts:
${context}
`;

  return await ctx.runAction(internal.documents.callLLM, {
    prompt,
    systemMessage: "You create clear, chronological timelines from factual data.",
  });
}
