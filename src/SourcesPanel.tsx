import { useMutation, useQuery } from "convex/react";
    import { api } from "../convex/_generated/api";
    import { Id } from "../convex/_generated/dataModel";
    import { useState } from "react";

    interface SourcesPanelProps {
      notebookId: Id<"notebooks">; // To potentially filter documents by notebook in future
    }

    export default function SourcesPanel({ notebookId }: SourcesPanelProps) {
      // Currently lists all documents for the user.
      // TODO: Filter documents based on those linked to the current notebookId,
      // or implement a system to link documents to notebooks.
      const documents = useQuery(api.documents.listDocuments, {}) || [];
      const [isUploading, setIsUploading] = useState(false);
      const [uploadProgress, setUploadProgress] = useState(0);
      const [selectedDocuments, setSelectedDocuments] = useState<Set<Id<"documents">>>(new Set());
      const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
      const createDocument = useMutation(api.documents.createDocument);
      const linkDocumentToNotebook = useMutation(api.documents.linkDocumentToNotebook);

      const CLOUDINARY_UPLOAD_PRESET = "note-book-companion"; // Replace with your preset name
      const CLOUDINARY_CLOUD_NAME = "dcmjg2lmc"; // Replace with your Cloudinary cloud name
      // const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;
      const CLOUDINARY_UPLOAD_URL = "cloudinary://521165744352871:BekIshV3n2oZF18kP6t-iFbdhbA@dcmjg2lmc"
      const apiKey = "521165744352871"; 
      const apiSecret = "BekIshV3n2oZF18kP6t-iFbdhbA"; 

      const handleSelectDocument = (docId: Id<"documents">) => {
        setSelectedDocuments(prev => {
          const newSet = new Set(prev);
          if (newSet.has(docId)) {
            newSet.delete(docId);
          } else {
            newSet.add(docId);
          }
          return newSet;
        });
      };

      const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
          setSelectedDocuments(new Set(documents.map(doc => doc._id)));
        } else {
          setSelectedDocuments(new Set());
        }
      };

    //   const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    //     if (!event.target.files) return; // Add null check
    //     const file = event.target.files[0];
    //     if (!file) return;
      
    //     try {
    //       setIsUploading(true);
    //       setUploadProgress(10);
          
    //       // Step 1: Get a pre-signed upload URL from Convex
    //       const uploadUrl = await generateUploadUrl();
    //       setUploadProgress(20);
          
    //       // Step 2: Upload the file to storage
    //       const result = await fetch(uploadUrl, {
    //         method: "POST",
    //         headers: { "Content-Type": file.type },
    //         body: file,
    //       });
          
    //       if (!result.ok) {
    //         throw new Error(`Upload failed: ${result.statusText}`);
    //       }
          
    //       const { storageId } = await result.json();
    //       setUploadProgress(60);
          
    //       // Step 3: Create document record in Convex
    //       const fileType = getFileType(file.name);
    //       const documentId = await createDocument({
    //         fileName: file.name,
    //         fileUrl: storageId,
    //         textContent: "", // Initialize with empty string, content will be processed later
    //         type: fileType,
    //         status: "processing", // Initial status
    //       });
    //       setUploadProgress(80);
          
    //       // Step 4: Link document to the current notebook
    //       await linkDocumentToNotebook({
    //         documentId,
    //         notebookId,
    //       });
          
    //       setUploadProgress(100);
          
    //       // Reset the file input
    //       event.target.value = ''; // Set value to empty string to clear the input
    //     } catch (error) {
    //       console.error("File upload failed:", error);
    //       alert("Failed to upload document. Please try again.");
    //     } finally {
    //       setIsUploading(false);
    //       setUploadProgress(0);
    //     }
    //  };
      
      const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return;
        const file = event.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(10);

        try {
          // 1. Prepare form data for Cloudinary
          const formData = new FormData();
          formData.append("file", file);
          formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

          // 2. Upload to Cloudinary
          const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
          const response = await fetch(uploadUrl, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Cloudinary upload failed: ${response.statusText}`);
          }

          const data = await response.json();
          setUploadProgress(60);

          // 3. Save document record in Convex (or your backend)
          const fileType = getFileType(file.name);
          const documentId = await createDocument({
            fileName: file.name,
            fileUrl: data.secure_url, 
            textContent: "",
            type: fileType,
            status: "processing",
          });
          setUploadProgress(80);

          // 4. Link document to notebook
          await linkDocumentToNotebook({
            documentId,
            notebookId,
          });

          setUploadProgress(100);
          event.target.value = '';
        } catch (error) {
          console.error("File upload failed:", error);
          alert("Failed to upload document. Please try again.");
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      };

    
      const getFileType = (fileName: string) => {
        const extension = fileName.split('.').pop()?.toLowerCase() || '';
        switch (extension) {
          case 'pdf':
            return "pdf";
          case 'txt':
            return "txt";
          case 'doc':
          case 'docx':
            return "gdoc"; 
          default:
            return "txt"; 
        }
      };
      
      const allSelected = documents && documents.length > 0 && selectedDocuments.size === documents.length;

      return (
        <div className="h-full flex flex-col">
          <h2 className="text-xl font-semibold mb-4 text-slate-700 dark:text-dark-text">Sources</h2>
          <div className="mb-4 flex space-x-2">
            {/* <button
              className="flex-1 bg-brand-primary hover:bg-brand-tertiary text-white py-2 px-3 rounded text-sm"
              // onClick={handleAddSourceClick}
              >
              + Add Source
            </button> */}

            <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-dark-text">
              Upload Document
            </label>
            <input
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={(event) => { void handleFileUpload(event); }}
                disabled={isUploading}
                title="Upload Document" // Added title for accessibility
                className="block w-full text-sm text-slate-700 dark:text-dark-text
                          file:mr-4 file:py-2 file:px-4
                          file:rounded file:border-0
                          file:text-sm file:font-semibold
                          file:bg-brand-primary file:text-white
                          hover:file:bg-brand-tertiary
                          disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {isUploading && (
              <div className="mt-2">
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                  <div 
                    className="bg-brand-primary h-2.5 rounded-full" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            <button className="flex-1 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 py-2 px-3 rounded text-sm text-slate-700 dark:text-dark-text">
              Discover
            </button>
          </div>
          
          {documents.length > 0 && (
            <div className="mb-3 pb-3 border-b dark:border-slate-700">
              <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-600 dark:text-slate-300">
                <input 
                  type="checkbox" 
                  className="form-checkbox rounded text-brand-primary focus:ring-brand-primary"
                  checked={allSelected}
                  onChange={handleSelectAll}
                />
                <span>Select all sources ({selectedDocuments.size}/{documents.length})</span>
              </label>
            </div>
          )}

          <ul className="space-y-2 overflow-y-auto flex-1">
            {documents.length === 0 && <p className="text-slate-500 dark:text-slate-400">No documents found. Click "+ Add Source".</p>}
            {documents.map((doc) => (
              <li key={doc._id} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-600">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="form-checkbox rounded text-brand-primary focus:ring-brand-primary"
                    checked={selectedDocuments.has(doc._id)}
                    onChange={() => handleSelectDocument(doc._id)}
                  />
                  <span className="text-sm text-slate-700 dark:text-dark-text-secondary group-hover:text-brand-primary">
                    {doc.fileName} ({doc.type}, {doc.status})
                  </span>
                  {/* Placeholder for document type icon */}
                  <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">📄</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      );
    }
