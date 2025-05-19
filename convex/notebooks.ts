import { getAuthUserId } from "@convex-dev/auth/server";
import { action, mutation, query, QueryCtx } from "./_generated/server";
import { DataModel, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import OpenAI from 'openai';
import { internal } from "./_generated/api";


const openai = new OpenAI({
  baseURL: process.env.CONVEX_OPENAI_BASE_URL,
  apiKey: process.env.CONVEX_OPENAI_API_KEY,
});

export const createNotebooks = mutation({
    args: {
        title: v.string(),
        userId: v.id("user"),
    },

    handler: async(ctx, args) => {
        const {title, userId} = args;
        const notebook = await ctx.db.insert("notebooks",{
            title,
            userId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        })

        return notebook;
    }
})

export const listNotebooks = query({
    args: {},
    handler: async(ctx: QueryCtx) => {
        const userId = await getAuthUserId(ctx);
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


export const createNote = action({
    args:{
        noteBookId: v.id("notebooks"),
        title: v.string(),
        content: v.string(),
        user: v.id("user"),
        knowledgeEntryId: v.optional(v.id("knowledgeEntries")),
    },
    handler: async(ctx, args): Promise<Id<"notes">> => {
        const response = await openai.embeddings.create({
            model: "gpt-4o-mini",
            input: args.content,
        })

        const embedding = response.data[0].embedding;

        //create note with embedding
        return await ctx.runMutation(internal.notebooks.createNoteInternal, {
            ...args,
            embedding,
        })
    }
})
