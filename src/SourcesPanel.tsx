import { useQuery } from "convex/react";
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
      const [selectedDocuments, setSelectedDocuments] = useState<Set<Id<"documents">>>(new Set());

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
      
      const allSelected = documents.length > 0 && selectedDocuments.size === documents.length;

      return (
        <div className="h-full flex flex-col">
          <h2 className="text-xl font-semibold mb-4 text-slate-700 dark:text-dark-text">Sources</h2>
          <div className="mb-4 flex space-x-2">
            <button className="flex-1 bg-brand-primary hover:bg-brand-tertiary text-white py-2 px-3 rounded text-sm">
              + Add Source
            </button>
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
