import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { ActionCtx, QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const EMBEDDING_MODEL = "text-embedding-004";
const GENERATIVE_MODEL = "gemini-1.5-flash-latest"; // Or "gemini-pro"

async function getAuthenticatedUserId(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId;
}

export const internalSaveMessage = internalMutation({
  args: {
    notebookId: v.id("notebooks"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", {
      notebookId: args.notebookId,
      userId: args.userId,
      role: args.role,
      content: args.content,
    });
  },
});

export const sendMessage = action({
  args: {
    notebookId: v.id("notebooks"),
    userQuery: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);

    await ctx.runMutation(internal.chat.internalSaveMessage, {
      notebookId: args.notebookId,
      userId,
      role: "user" as const,
      content: args.userQuery,
    });

    const apiKey = process.env.CONVEX_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("CONVEX_GEMINI_API_KEY not set.");
      await ctx.runMutation(internal.chat.internalSaveMessage, {
        notebookId: args.notebookId,
        userId,
        role: "assistant" as const,
        content: "Error: AI service is not configured. Missing API key.",
      });
      throw new Error("CONVEX_GEMINI_API_KEY environment variable not set.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const generativeModel = genAI.getGenerativeModel({ 
      model: GENERATIVE_MODEL,
      safetySettings: [ // Basic safety settings
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ]
    });

    let assistantResponse = "I am having trouble processing your request right now.";

    try {
      // 1. Generate embedding for the user query
      const queryEmbeddingResponse = await embeddingModel.embedContent(args.userQuery);
      const queryEmbedding = queryEmbeddingResponse.embedding.values;

      // 2. Retrieve context using vector search
      const contextChunksText: string = await ctx.runQuery(internal.documents.searchChunksForContext, {
        userId,
        queryEmbedding,
        // notebookId: args.notebookId, // TODO: Implement notebook-specific context
      });

      // 3. Construct prompt for the generative model
      const prompt = `You are a helpful assistant. Answer the user's query based on the following context. If the context is not sufficient, say so.
Context:
---
${contextChunksText || "No relevant context found."}
---
User Query: ${args.userQuery}
Answer:`;

      // 4. Call the generative model
      const result = await generativeModel.generateContent(prompt);
      assistantResponse = result.response.text();

    } catch (error: any) {
      console.error("Error in RAG pipeline:", error);
      assistantResponse = `Sorry, I encountered an error: ${error.message || "Unknown error"}`;
       if (error.response && error.response.promptFeedback) {
        console.error("Prompt Feedback:", error.response.promptFeedback);
        assistantResponse += ` (AI Safety Feedback: ${JSON.stringify(error.response.promptFeedback)})`;
      }
    }

    await ctx.runMutation(internal.chat.internalSaveMessage, {
      notebookId: args.notebookId,
      userId, 
      role: "assistant" as const,
      content: assistantResponse,
    });

    return { success: true };
  },
});

export const listMessages = query({
  args: { notebookId: v.id("notebooks") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    // Optional: Add check to ensure user has access to this notebook
    const notebook = await ctx.db.get(args.notebookId);
    if (!notebook || notebook.userId !== userId) {
       console.warn(`User ${userId} attempted to access messages for notebook ${args.notebookId} without ownership.`);
       return []; 
    }

    return await ctx.db
      .query("chatMessages")
      .withIndex("by_notebookId", (q) => 
        q.eq("notebookId", args.notebookId)
      )
      .order("asc") 
      .collect();
  },
});
