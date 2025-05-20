import { action, internalMutation, mutation, query, QueryCtx } from "./_generated/server";
import { DataModel, Id } from "./_generated/dataModel";
import { v } from "convex/values";
//import OpenAI from 'openai';
import { internal, api } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";

// const openai = new OpenAI({
//   baseURL: process.env.CONVEX_OPENAI_BASE_URL,
//   apiKey: process.env.CONVEX_OPENAI_API_KEY,
// });

export const createNotebooks = mutation({
    args: {
        title: v.string(),
        userId: v.id("user"),
        description: v.optional(v.string()),
    },

    handler: async(ctx, args) => {
        const {title, userId, description} = args;
        const notebook = await ctx.db.insert("notebooks",{
            title,
            userId,
            description,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        })

        return notebook;
    }
})



export const listNotebooks = query({
    args: {},
    handler: async(ctx: QueryCtx) => {
        const userId = (await ctx.auth.getUserIdentity())?.subject;
        if(!userId) {
            throw new Error("User not authenticated");
        }

        return (ctx.db
        .query("notebooks") as any) // Temporarily bypass type check for diagnosis
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .order("desc")
        .collect()
    }
})


export const createNoteInternal = internalMutation({
    args: {
        notebookId: v.id("notebooks"),
        title: v.string(),
        content: v.string(),
        userId: v.id("user"), // Changed from user to userId
        knowledgeEntryIds: v.array(v.id("knowledgeEntries")), // Changed from knowledgeEntryId to knowledgeEntryIds and made it an array
        embedding: v.array(v.float64()), // Assuming embedding is an array of numbers
    },
    handler: async(ctx, args) => {
        const { notebookId, title, content, userId, knowledgeEntryIds, embedding } = args; // Changed user to userId, knowledgeEntryId to knowledgeEntryIds
        const note = await ctx.db.insert("notes", {
            notebookId,
            title,
            content,
            userId, // Changed user to userId
            knowledgeEntryIds, // Changed knowledgeEntryId to knowledgeEntryIds
            embedding,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        return note;
    }
});

export const createNote = action({
    args:{
        notebookId: v.id("notebooks"),
        title: v.string(),
        content: v.string(),
        userId: v.id("user"), // Changed from user to userId
        knowledgeEntryIds: v.array(v.id("knowledgeEntries")), // Changed from knowledgeEntryId to knowledgeEntryIds and made it an array
    },
    handler: async(ctx, args): Promise<Id<"notes">> => {
        const ai = new GoogleGenAI({ apiKey: process.env.CONVEX_GEMINI_API_KEY });

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: args.content,
         });
        // const response = await openai.embeddings.create({
        //     model: "gpt-4o-mini",
        //     input: args.content,
        // })
        //  const embedding = response.data[0].embedding;

        // Check if response.data is defined and has at least one element
        if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
            throw new Error("Failed to generate embedding: response data is missing or empty.");
        }

        const embedding = response.data[0].embedding;

        //create note with embedding
        return await ctx.runMutation(internal.notebooks.createNoteInternal, {
            ...args,
            embedding,
        })
    }
})


export const listNotesByNoteBook = query({
    args:{ notebookId: v.id("notebooks") },
    handler: async(ctx, args) => {
        const userId = (await ctx.auth.getUserIdentity())?.subject;
        if(!userId) {
            throw new Error("User not authenticated");
        }
        const { notebookId } = args;
        return await ctx.db
        .query("notes")
        .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
        .collect();
    }
})



export const createDocument = mutation({
  args: {
    fileName: v.string(),
    textContent: v.string(),
    type: v.union(v.literal("pdf"), v.literal("txt"), v.literal("gdoc"), v.literal("url")),
    fileUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("document", { 
      userId: userId as Id<"user">,
      fileName: args.fileName,
      textContent: args.textContent,
      type: args.type,
      fileUrl: args.fileUrl,
      status: "processing",
      createdAt: Date.now(), 
      updatedAt: Date.now(),
    });
  },
});

export const updateDocument = mutation({
  args: {
    documentId: v.id("document"), // Changed from documents to document
    fileName: v.optional(v.string()),
    textContent: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    )),
  },
  handler: async (ctx, args) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) throw new Error("Not authenticated");

    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");
    if (document.userId !== userId) throw new Error("Not authorized"); // Accessing document.userId

    const updates: any = { updatedAt: Date.now() };
    if (args.fileName !== undefined) updates.fileName = args.fileName;
    if (args.textContent !== undefined) updates.textContent = args.textContent;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.documentId, updates);
  },
});

export const deleteDocument = mutation({
  args: {
    documentId: v.id("document"), 
  },
  handler: async (ctx, args) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) throw new Error("Not authenticated");

    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");
    if (document.userId !== userId) throw new Error("Not authorized"); // Accessing document.userId

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
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) return [];

    if (args.status) {
      const status = args.status;
      return await ctx.db
        .query("document") // Changed from documents to document
        .withIndex("by_user_status", (q) => // Index name matches schema
          q.eq("userId", userId as Id<"user">).eq("status", status) // Field names match schema
        )
        .order("desc")
        .collect()
    }

    return await ctx.db
      .query("document") // Changed from documents to document
      .withIndex("by_user", q => q.eq("userId", userId as Id<"user">)) // Index name and field name match schema
      .order("desc")
      .collect();
  },
});

export const getDocument = query({
  args: {
    documentId: v.id("document"), // Changed from documents to document
  },
  handler: async (ctx, args) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) throw new Error("Not authenticated");

    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");
    if (document.userId !== userId) throw new Error("Not authorized"); // Accessing document.userId

    return document;
  },
});



export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) return null;

    // Assuming the user table has a field that stores the auth subject (user ID)
    // You might need to query the user table by this subject if it's stored there.
    // For now, returning the subject itself as a placeholder.
    return userId; // Returning the subject as the user ID
  },
});

// export const getUserByEmail = query({
//   args: {
//     email: v.string(),
//   },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) throw new Error("Not authenticated");

//     return await ctx.db
//       .query("users")
//       .withIndex("email", q => q.eq("email", args.email))
//       .unique();
//   },
// });
