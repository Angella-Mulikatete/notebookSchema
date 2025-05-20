'use client'

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export default function DocumentList() {
  const documents = useQuery(api.notebooks.listDocuments, {}) ?? [];
  const createDocument = useMutation(api.notebooks.createDocument);
  const [newDoc, setNewDoc] = useState({ fileName: "", content: "", type: "txt" as const });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.fileName.trim()) return;
    
    await createDocument({
      fileName: newDoc.fileName,
      textContent: newDoc.content,
      type: newDoc.type,
    });
    setNewDoc({ fileName: "", content: "", type: "txt" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-playfair font-bold text-foreground">Documents</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-card rounded-lg border border-border shadow-sm">
        <input
          type="text"
          value={newDoc.fileName}
          onChange={(e) => setNewDoc(prev => ({ ...prev, fileName: e.target.value }))}
          placeholder="Document name..."
          className="input-field"
        />
        <textarea
          value={newDoc.content}
          onChange={(e) => setNewDoc(prev => ({ ...prev, content: e.target.value }))}
          placeholder="Document content..."
          className="input-field min-h-[96px]"
        />
        <div className="flex gap-2 items-end">
          <div className="flex flex-col flex-grow">
            <label htmlFor="document-type" className="text-sm font-medium text-muted-foreground mb-1">Document Type</label>
            <select
              id="document-type"
              value={newDoc.type}
              onChange={(e) => setNewDoc(prev => ({ ...prev, type: e.target.value as any }))}
              className="input-field"
            >
              <option value="txt">Text</option>
              <option value="pdf">PDF</option>
              <option value="gdoc">Google Doc</option>
              <option value="url">URL</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!newDoc.fileName.trim()}
            className="px-4 py-2 text-primary-foreground bg-brand-primary rounded-lg hover:bg-brand-tertiary disabled:opacity-50 transition-colors"
          >
            Add Document
          </button>
        </div>
      </form>

      <div className="grid gap-4">
        {documents.map((doc) => (
          <div
            key={doc._id}
            className="p-6 bg-card border border-border rounded-lg hover:border-brand-primary transition-colors shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-foreground">{doc.fileName}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {/* {new Date(doc.updatedAt).toLocaleDateString()} */}
                    {new Date(doc.updatedAt).toISOString().slice(0, 10)}
                </span>
                <span className={`px-2 py-1 text-sm rounded-full ${
                  doc.status === "ready" ? "bg-brand-secondary text-brand-primary" :
                  doc.status === "processing" ? "bg-brand-yellow/20 text-brand-yellow" :
                  "bg-destructive/10 text-destructive"
                }`}>
                  {doc.status}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {doc.textContent}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 bg-muted rounded-full">
                {doc.type}
              </span>
              {doc.fileUrl && (
                <a 
                  href={doc.fileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-brand-primary hover:text-brand-tertiary"
                >
                  View Original
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
