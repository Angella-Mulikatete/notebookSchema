import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const EMBEDDING_DIMENSION = 1536; 

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
    type: v.union(v.literal("pdf"), v.literal("txt"), v.literal("gdoc"), v.literal("url")),
    status: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    ),
    }),

    chunks: defineTable({
    userId: v.id("user"),        
    documentId: v.id("document"),    // Which original document the chunk came from
    text:v.string(),             // The actual text content of the chunk
    embedding: v.array(v.float64()), // The vector embedding for the chunk's text
    processedAt: v.number(),
  })
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: EMBEDDING_DIMENSION,
    filterFields: ["userId", "documentId"],
  })
  .index("by_document", ["documentId"])
  .index("by_user_document", ["userId", "documentId"]),


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
    userId: v.id("users"), 
    title: v.string(),
    content: v.string(),
    embedding: v.optional(v.array(v.float64())),
    knowledgeEntryIds: v.array(v.id("knowledgeEntries")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
  .vectorIndex("by_note_embedding", {
    vectorField: "embedding", 
    dimensions: EMBEDDING_DIMENSION,
    filterFields: ["userId"],
  }),

});


