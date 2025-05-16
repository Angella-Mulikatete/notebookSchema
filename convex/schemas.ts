import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  user: defineTable({
    body: v.string(),
    email: v.string(),
  }),

  document: defineTable({
    userId: v.id("user"),
    fileName: v.string(),
    fileUrl: v.optional(v.string()), 
    textContent: v.string(), 
    chunks: v.array(v.object({
      id: v.string(),
      text: v.string(), 
      startOffset: v.number(), 
      endOffset: v.number(),
    })),
    status: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    ),
    }),

    knowledgeEntries: defineTable({
    documentId: v.id("documents"),
    chunkId: v.string(), 
    summary: v.string(),
    facts: v.array(v.string()),
    questions: v.array(v.string()),
    embeddings: v.optional(v.array(v.number())), 
    }), 

    notebooks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    }),

  notes: defineTable( {
    notebookId: v.id("notebooks"),
    title: v.string(),
    content: v.string(),
    knowledgeEntryIds: v.array(v.id("knowledgeEntries")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  
  chunk: defineTable({
    text: v.string(),
    startOffset: v.number(),
    endOffset: v.number(),
    }),
});
