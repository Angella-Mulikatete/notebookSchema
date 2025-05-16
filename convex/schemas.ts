import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const EMBEDDING_DIMENSION = 1536; 

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.string(),
    // Added fields commonly used in auth-based applications
    tokenIdentifier: v.optional(v.string()),
  }).index("by_email", ["email"])
    .index("by_tokenIdentifier", ["tokenIdentifier"]),

  documents: defineTable({
    userId: v.id("users"),
    fileName: v.string(),
    fileUrl: v.optional(v.string()), 
    textContent: v.string(), 
    type: v.union(v.literal("pdf"), v.literal("txt"), v.literal("gdoc"), v.literal("url")),
    status: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    ),
    embedding: v.optional(v.array(v.float64())),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
  .index("by_userId", ["userId"])
  .index("by_status", ["status"])
  .index("by_userId_type", ["userId", "type"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: EMBEDDING_DIMENSION,
    filterFields: ["userId"],
  }),

  chunks: defineTable({
    userId: v.id("users"),        
    documentId: v.id("documents"),    // Which original document the chunk came from
    text: v.string(),             // The actual text content of the chunk
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
    chunkId: v.id("chunks"), // Updated from string to ID reference
    summary: v.string(),
    facts: v.array(v.string()),
    questions: v.array(v.string()),
    embedding: v.optional(v.array(v.float64())), // Renamed for consistency
    createdAt: v.number(),
  })
  .index("by_documentId", ["documentId"])
  .vectorIndex("by_entry_embedding", {
    vectorField: "embedding",
    dimensions: EMBEDDING_DIMENSION,
    filterFields: ["documentId"],
  }),

  notebooks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    // Fields for collaboration
    isPublic: v.optional(v.boolean()),
    collaboratorIds: v.optional(v.array(v.id("users"))),
  })
  .index("by_userId", ["userId"])
  .index("by_isPublic", ["isPublic"]),

  notes: defineTable({
    notebookId: v.id("notebooks"),
    userId: v.id("users"), 
    title: v.string(),
    content: v.string(),
    embedding: v.optional(v.array(v.float64())),
    knowledgeEntryIds: v.array(v.id("knowledgeEntries")),
    createdAt: v.number(),
    updatedAt: v.number(),
    // For categorization and organization
    tags: v.optional(v.array(v.string())),
  })
  .index("by_user", ["userId"])
  .index("by_notebook", ["notebookId"])
  .index("by_notebook_user", ["notebookId", "userId"])
  .vectorIndex("by_note_embedding", {
    vectorField: "embedding", 
    dimensions: EMBEDDING_DIMENSION,
    filterFields: ["userId", "notebookId"],
  }),

  // New table to track sharing and permissions
  notebookPermissions: defineTable({
    notebookId: v.id("notebooks"),
    userId: v.id("users"),
    role: v.union(v.literal("viewer"), v.literal("editor"), v.literal("admin")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
  .index("by_notebookId", ["notebookId"])
  .index("by_userId", ["userId"])
  .index("by_notebook_user", ["notebookId", "userId"]),

  // New table for audio overviews
  audioOverviews: defineTable({
    notebookId: v.id("notebooks"),
    userId: v.id("users"),
    title: v.string(),
    fileUrl: v.string(),
    durationSeconds: v.number(),
    createdAt: v.number(),
    // For customization of AI hosts
    hostStyle: v.optional(v.string()),
    isInteractive: v.optional(v.boolean()),
  })
  .index("by_notebookId", ["notebookId"])
  .index("by_userId", ["userId"]),
});


