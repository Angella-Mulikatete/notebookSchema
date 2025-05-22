import type { NextApiRequest, NextApiResponse } from 'next';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set the worker source for pdf.js
const WORKER_SRC = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
}

// Define response type
type ProcessDocumentResponse = {
  textContent: string;
  chunks: string[];
  status: 'success' | 'error';
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProcessDocumentResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      error: 'Method not allowed', 
      textContent: '', 
      chunks: [] 
    });
  }

  console.log('[API] Received request to /api/process-document');
  
  try {
    // Check for API key if needed
    // const apiKey = req.headers['authorization'];
    // if (process.env.PROCESS_DOCUMENT_API_KEY && 
    //     (!apiKey || apiKey !== process.env.PROCESS_DOCUMENT_API_KEY)) {
    //   console.error('[API] Unauthorized request: Missing or invalid API key');
    //   return res.status(401).json({ 
    //     status: 'error', 
    //     error: 'Unauthorized', 
    //     textContent: '', 
    //     chunks: [] 
    //   });
    // }

    const { fileUrl, fileType } = req.body;

    console.log(`[API] Processing document: fileUrl=${fileUrl}, fileType=${fileType}`);

    if (!fileUrl || !fileType) {
      console.error('[API] Missing fileUrl or fileType in request body');
      return res.status(400).json({ 
        status: 'error', 
        error: 'Missing fileUrl or fileType', 
        textContent: '', 
        chunks: [] 
      });
    }

    // Fetch the document from the provided URL
    console.log(`[API] Fetching document from ${fileUrl}`);
    const response = await fetch(fileUrl);
    console.log(`[API] Finished fetching document. Status: ${response.status}`);

    if (!response.ok) {
      console.error(`[API] Failed to fetch document: ${response.statusText}`);
      return res.status(500).json({
        status: 'error',
        error: `Failed to fetch document: ${response.statusText}`,
        textContent: '',
        chunks: []
      });
    }

    const buffer = await response.arrayBuffer();
    let textContent = '';

    // Extract text based on file type
    console.log(`[API] Extracting text for file type: ${fileType}`);
    if (fileType === 'pdf') {
        
      // Use pdf.js for PDF extraction
      const loadingTask = pdfjs.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        fullText += strings.join(' ') + '\n';
      }
      textContent = fullText;
    } else if (fileType === 'txt') {
      textContent = Buffer.from(buffer).toString('utf-8');
    } else if (fileType === 'gdoc' || fileType === 'docx') {
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      textContent = result.value;
    } else if (fileType === 'url') {
      textContent = Buffer.from(buffer).toString('utf-8');
    } else {
      console.error(`[API] Unsupported file type: ${fileType}`);
      return res.status(400).json({ 
        status: 'error', 
        error: 'Unsupported file type', 
        textContent: '', 
        chunks: [] 
      });
    }
    console.log(`[API] Text extraction complete. Extracted ${textContent.length} characters.`);

    // Process text into chunks
    console.log('[API] Processing text into chunks');
    const MAX_CHUNK_TEXT_LENGTH = 1000;
    const rawChunks = textContent.split(/\n+/).flatMap(paragraph => {
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
    console.log(`[API] Chunking complete. Created ${rawChunks.length} chunks.`);

    // Return the extracted text and chunks
    console.log('[API] Sending success response with textContent and chunks');
    return res.status(200).json({
      textContent,
      chunks: rawChunks,
      status: 'success'
    });
  } catch (error: any) {
    console.error('[API] Error processing document:', error);
    return res.status(500).json({
      status: 'error',
      error: `Error processing document: ${error.message}`,
      textContent: '',
      chunks: []
    });
  }
}

// Increase the body size limit if needed for large documents
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
