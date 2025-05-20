import { defineSchema, defineTable } from "convex/server";
    import { v } from "convex/values";
    import { authTables } from "@convex-dev/auth/server";
    
    const EMBEDDING_DIMENSION = 768; // Gemini embedding model dimension
    
    const applicationTables = {
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
      })
      .index("by_userId_and_status", ["userId", "status"]),
    
      chunks: defineTable({
        userId: v.id("users"), 
        documentId: v.id("documents"),    
        text:v.string(),             
        embedding: v.array(v.float64()), 
      })
      .vectorIndex("by_embedding", {
        vectorField: "embedding",
        dimensions: EMBEDDING_DIMENSION,
        filterFields: ["userId", "documentId"],
      })
      .index("by_userId_and_documentId", ["userId", "documentId"]),
    
      knowledgeEntries: defineTable({
        documentId: v.id("documents"),
        chunkId: v.string(), 
        summary: v.string(),
        facts: v.array(v.string()),
        questions: v.array(v.string()),
        embeddings: v.optional(v.array(v.float64())), 
      })
      .index("by_documentId", ["documentId"])
      .index("by_chunkId", ["chunkId"]),
    
      notebooks: defineTable({
        userId: v.id("users"), 
        title: v.string(),
        description: v.optional(v.string()),
      })
      .index("by_userId", ["userId"]),
    
      notes: defineTable( {
        notebookId: v.id("notebooks"),
        userId: v.id("users"), 
        title: v.string(),
        content: v.string(),
        embedding: v.optional(v.array(v.float64())),
        knowledgeEntryIds: v.array(v.id("knowledgeEntries")),
      })
      .index("by_userId", ["userId"])
      .index("by_notebookId", ["notebookId"])
      .vectorIndex("by_embedding", { 
        vectorField: "embedding",
        dimensions: EMBEDDING_DIMENSION,
        filterFields: ["userId"],
      }),

      chatMessages: defineTable({
        notebookId: v.id("notebooks"),
        userId: v.id("users"), 
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
      // Corrected index: Convex automatically includes _creationTime.
      // We only need to specify other fields if we want to query by them before _creationTime.
      // For ordering by creationTime within a notebook, just querying by notebookId is sufficient
      // as the default order or .order("asc")/.order("desc") on the query will use _creationTime.
      .index("by_notebookId", ["notebookId"]), 
    };
    
    export default defineSchema({
      ...authTables, 
      ...applicationTables,
    });
