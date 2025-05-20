// REMOVED "use node"; -- Mutations and queries cannot be in "use node" files.
// Actions that need Node.js (like createNote) are fine.
import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { GoogleGenerativeAI } from "@google/generative-ai"; // This is fine in an action

const EMBEDDING_MODEL = "text-embedding-004";

async function getAuthenticatedUserId(ctx: QueryCtx | MutationCtx | ActionCtx) { 
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId;
}

export const createNotebook = mutation({
    args: {
        title: v.string(),
        description: v.optional(v.string()),
    },
    handler: async(ctx, args) => {
        const userId = await getAuthenticatedUserId(ctx);
        const {title, description} = args;
        const notebookId = await ctx.db.insert("notebooks",{
            title,
            userId,
            description,
        });
        return notebookId;
    }
});

export const listNotebooks = query({
    args: {}, 
    handler: async(ctx, args) => {
        const userId = await getAuthenticatedUserId(ctx);
        return await ctx.db
            .query("notebooks")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();
    }
});

export const createNoteInternal = internalMutation({
    args: {
        notebookId: v.id("notebooks"),
        title: v.string(),
        content: v.string(),
        userId: v.id("users"),
        knowledgeEntryIds: v.array(v.id("knowledgeEntries")),
        embedding: v.array(v.float64()),
    },
    handler: async(ctx, args) => {
        const { notebookId, title, content, userId, knowledgeEntryIds, embedding } = args;
        const noteId = await ctx.db.insert("notes", {
            notebookId,
            title,
            content,
            userId,
            knowledgeEntryIds,
            embedding,
        });
        return noteId;
    }
});

export const createNote = action({
    args:{
        notebookId: v.id("notebooks"),
        title: v.string(),
        content: v.string(),
        knowledgeEntryIds: v.array(v.id("knowledgeEntries")),
    },
    handler: async(ctx, args): Promise<Id<"notes">> => {
        const userId = await getAuthenticatedUserId(ctx); 

        const apiKey = process.env.CONVEX_GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("CONVEX_GEMINI_API_KEY environment variable not set. Please set it in your Convex project settings.");
        }
        const genAI = new GoogleGenerativeAI(apiKey); // Node.js specific SDK
        const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

        const embeddingResponse = await model.embedContent(args.content);
        const embedding = embeddingResponse.embedding.values;

        if (!embedding) {
            throw new Error("Failed to generate embedding: embedding data is missing.");
        }

        return await ctx.runMutation(internal.notebooks.createNoteInternal, {
            notebookId: args.notebookId,
            title: args.title,
            content: args.content,
            userId, 
            knowledgeEntryIds: args.knowledgeEntryIds,
            embedding,
        });
    }
});

export const listNotesByNotebook = query({
    args:{ notebookId: v.id("notebooks") },
    handler: async(ctx, args) => {
        const userId = await getAuthenticatedUserId(ctx); 
        
        const notebook = await ctx.db.get(args.notebookId);
        if (!notebook || notebook.userId !== userId) {
            console.warn(`Attempt to access notes for notebook ${args.notebookId} by user ${userId}, but notebook not found or user does not own it.`);
            return []; 
        }

        return await ctx.db
            .query("notes")
            .withIndex("by_notebookId", (q) => q.eq("notebookId", args.notebookId))
            .filter(q => q.eq(q.field("userId"), userId)) 
            .order("desc")
            .collect();
    }
});

export const deleteNotebook = mutation({
  args: { notebookId: v.id("notebooks") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const notebook = await ctx.db.get(args.notebookId);

    if (!notebook) {
      throw new Error("Notebook not found");
    }
    if (notebook.userId !== userId) {
      throw new Error("You are not authorized to delete this notebook.");
    }

    const notesToDelete = await ctx.db
      .query("notes")
      .withIndex("by_notebookId", (q) => q.eq("notebookId", args.notebookId))
      .filter(q => q.eq(q.field("userId"), userId)) 
      .collect();

    for (const note of notesToDelete) {
      await ctx.db.delete(note._id);
    }

    await ctx.db.delete(args.notebookId);
    return args.notebookId;
  },
});

export const deleteNote = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const note = await ctx.db.get(args.noteId);

    if (!note) {
      throw new Error("Note not found");
    }
    if (note.userId !== userId) {
      throw new Error("You are not authorized to delete this note.");
    }
    await ctx.db.delete(args.noteId);
    return args.noteId; 
  },
});
