/* eslint-disable @typescript-eslint/ban-ts-comment */
"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";

// @ts-ignore
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai"; 

const EMBEDDING_MODEL = "embedding-001"; // Or your actual Gemini embedding model
const MAX_CHUNK_TEXT_LENGTH = 1000; 

export const processDocumentContent = internalAction({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {

    //get the doc
    const document : Doc<"documents"> | null = await ctx.runQuery(internal.documents.getDocumentForProcessing, { documentId: args.documentId });
    if (!document) throw new Error("Document not found");

    // Check if fileUrl exists before fetching
    if (!document.fileUrl) {
      console.error(`Document ${document._id} is missing fileUrl, cannot process.`);
      await ctx.runMutation(internal.documents.updateDocumentStatus, {
        documentId: document._id,
        status: "failed",
        errorMessage: "Document is missing file URL."
      });
      return; // Stop processing if fileUrl is missing
    }

    //download the file from the cloudinary
    console.log(`Fetching document content from ${document.fileUrl}`);
    const response = await fetch(document.fileUrl);

    if(!response.ok) throw new Error(`Failed to fetch document content from cloudinary: ${response.statusText}`);

    const buffer = await response.arrayBuffer();

    let textContent = "";
    
    //extract text based on file type
    try{
      if (document.type === "pdf") {
        const pdf = await pdfParse(Buffer.from(buffer));
        textContent = pdf.text;
        // const text = await pdf.getTextContent();
        // textContent = text.items.map((item: any) => item.str).join(" ");
      } else if (document.type === "txt") {
        // textContent = new TextDecoder().decode(buffer);
         textContent = Buffer.from(buffer).toString("utf-8");
      } else if (document.type === "gdoc") {
        // const gdoc = new TextDecoder().decode(buffer);
        // textContent = gdoc;
        const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        textContent = result.value;
      } else if (document.type === "url") {
        textContent = new TextDecoder().decode(buffer);
      }else {
        textContent = "[Unsupported file type]";
      }
    } catch(err){
      textContent = "Error extracting text"
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

    const rawChunks: string[] = (document.textContent ?? "").split(/\n+/).flatMap(paragraph => {
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


    if (rawChunks.length === 0 && (document.textContent ?? "").trim().length > 0) {
        
        rawChunks.push((document.textContent ?? "").trim());
    }

    if (rawChunks.length === 0) {
        console.log(`No processable chunks found for document ${document._id}. Content was: "${(document.textContent ?? "").substring(0,100)}..."`);
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

// export const processDocumentContent = internalAction({
//   args: { documentId: v.id("document") },
//   handler: async (ctx, args) => {
//     const document: Doc<"document"> | null = await ctx.runQuery(internal.notebooks.getDocumentForProcessing, { documentId: args.documentId });
//     if (!document) {
//       console.error(`Document ${args.documentId} not found for processing.`);
//       return;
//     }

//     if (document.status !== "processing") {
//         console.log(`Document ${args.documentId} is not in 'processing' state (current: ${document.status}). Skipping.`);
//         return;
//     }

//     if (!document.fileUrl && document.type !== "txt" && !document.textContent) { 
//       console.error(`Document ${document._id} is missing fileUrl (and not TXT with direct content), cannot process.`);
//       await ctx.runMutation(internal.notebooks.updateDocumentStatus, {
//         documentId: document._id,
//         status: "failed",
//         errorMessage: "Document is missing file URL or direct content for TXT."
//       });
//       return;
//     }

//     let textContent: string = ""; // Initialize as empty string
//     let sourceBuffer: ArrayBuffer | undefined = undefined;

//     if (document.fileUrl) {
//         try {
//             const response = await fetch(document.fileUrl);
//             if (!response.ok) {
//                 throw new Error(`Failed to fetch document content from ${document.fileUrl}: ${response.statusText}`);
//             }
//             sourceBuffer = await response.arrayBuffer();
//         } catch (error: any) {
//             console.error(`Error fetching document ${document._id} from ${document.fileUrl}:`, error);
//             await ctx.runMutation(internal.notebooks.updateDocumentStatus, {
//                 documentId: document._id,
//                 status: "failed",
//                 errorMessage: `Failed to fetch file: ${error.message}`
//             });
//             return;
//         }
//     }

//     try {
//       if (document.type === "pdf") {
//         if (!sourceBuffer) throw new Error("PDF source buffer is missing.");
//         const pdfData = await pdfParse(Buffer.from(sourceBuffer));
//         textContent = pdfData.text;
//       } else if (document.type === "txt") {
//         if (sourceBuffer) { 
//             textContent = Buffer.from(sourceBuffer).toString("utf-8");
//         } else { 
//             textContent = document.textContent ?? ""; // Handle undefined from optional schema
//         }
//       } else if (document.type === "gdoc") { 
//         if (!sourceBuffer) throw new Error("DOCX source buffer is missing.");
//         const result = await mammoth.extractRawText({ buffer: Buffer.from(sourceBuffer) });
//         textContent = result.value;
//       } else if (document.type === "url") {
//         if (sourceBuffer) {
//             textContent = Buffer.from(sourceBuffer).toString("utf-8"); 
//         } else {
//             textContent = document.textContent ?? ""; // Fallback if URL content was pre-fetched
//         }
//       } else {
//         console.warn(`Unsupported file type: ${document.type} for document ${document._id}`);
//         textContent = "[Unsupported file type]";
//       }
//     } catch (err: any) {
//       console.error(`Error extracting text for document ${document._id} (type: ${document.type}):`, err);
//       await ctx.runMutation(internal.notebooks.updateDocumentStatus, {
//         documentId: document._id,
//         status: "failed",
//         errorMessage: `Text extraction failed: ${err.message}`
//       });
//       // textContent remains as error message if we want to save it, or just return
//       return; 
//     }
    
//     await ctx.runMutation(internal.notebooks.updateDocumentTextContent, {
//         documentId: document._id,
//         textContent: textContent,
//     });

//     // Temporarily commenting out Gemini embedding part due to import issues / focus
//     /*
//     const apiKey = process.env.CONVEX_GEMINI_API_KEY;
//     if (!apiKey) {
//       await ctx.runMutation(internal.notebooks.updateDocumentStatus, {
//         documentId: document._id,
//         status: "failed",
//         errorMessage: "CONVEX_GEMINI_API_KEY environment variable not set."
//       });
//       console.error("CONVEX_GEMINI_API_KEY environment variable not set.");
//       return;
//     }

//     const genAI = new GoogleGenerativeAI(apiKey);
//     const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
//     */

//     const rawChunks: string[] = textContent.split(/\n+/).flatMap(paragraph => {
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


//     if (rawChunks.length === 0 && textContent.trim().length > 0) {
//         rawChunks.push(textContent.trim().substring(0, MAX_CHUNK_TEXT_LENGTH));
//     }

//     if (rawChunks.length === 0) {
//         console.log(`No processable chunks found for document ${document._id}. Content was: "${textContent.substring(0,100)}..."`);
//         await ctx.runMutation(internal.notebooks.updateDocumentStatus, {
//             documentId: document._id,
//             status: "ready", 
//             errorMessage: rawChunks.length === 0 && textContent.trim().length > 0 ? "Content too short or unchunkable." : "No processable content found in document."
//         });
//         return;
//     }

//     try {
//       for (const chunkText of rawChunks) {
//         if (!chunkText.trim()) continue;

//         // Placeholder for embedding generation if not using Gemini for now
//         const embedding: number[] = Array(1536).fill(0).map(() => Math.random()); // Using 1536 as a common dimension

//         /* // Gemini embedding code (commented out)
//         const embeddingResponse = await embeddingModel.embedContent(chunkText);
//         const embedding = embeddingResponse.embedding.values;
//         */

//         const chunkId = await ctx.runMutation(internal.notebooks.addChunk, {
//           userId: document.userId,
//           documentId: document._id,
//           text: chunkText,
//           embedding, // Use placeholder embedding
//         });
        
//         await ctx.runMutation(internal.notebooks.addKnowledgeEntry, {
//           documentId: document._id,
//           chunkId: chunkId.toString(), 
//           summary: `Summary of: ${chunkText.substring(0, Math.min(chunkText.length, 50))}...`, 
//           facts: [`Fact about: ${chunkText.substring(0, Math.min(chunkText.length, 30))}...`], 
//           questions: [`What is ${chunkText.substring(0, Math.min(chunkText.length, 20))}...?`], 
//         });
//       }
//       await ctx.runMutation(internal.notebooks.updateDocumentStatus, {
//         documentId: document._id,
//         status: "ready",
//       });
//     } catch (error: any) {
//       console.error(`Failed to process document content for ${document._id}:`, error);
//       await ctx.runMutation(internal.notebooks.updateDocumentStatus, {
//         documentId: document._id,
//         status: "failed",
//         errorMessage: error?.message ?? "Unknown error during chunk processing or embedding."
//       });
//     }
//   }
// });
