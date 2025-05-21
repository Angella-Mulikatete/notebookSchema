import { useQuery, useMutation } from "convex/react";
    import { api } from "../convex/_generated/api";
    import { FormEvent, useState } from "react";
    import { Id } from "../convex/_generated/dataModel";
    // NotesView is not directly used here anymore if selection leads to a different main view
    
    interface NotebooksViewProps {
      onSelectNotebook: (notebookId: Id<"notebooks">) => void;
    }
    
    export default function NotebooksView({ onSelectNotebook }: NotebooksViewProps) {
      const notebooks = useQuery(api.notebooks.listNotebooks) || [];
      const createNotebook = useMutation(api.notebooks.createNotebook);
      const deleteNotebook = useMutation(api.notebooks.deleteNotebook);
    
      const [newNotebookTitle, setNewNotebookTitle] = useState("");
      const [newNotebookDescription, setNewNotebookDescription] = useState("");
      // selectedNotebookId state is now managed by App.tsx
    
      async function handleCreateNotebook(event: FormEvent) {
        event.preventDefault();
        if (!newNotebookTitle.trim()) return;
        try {
          const newNotebookId = await createNotebook({ // Assuming createNotebook returns the ID
            title: newNotebookTitle,
            description: newNotebookDescription,
          });
          setNewNotebookTitle("");
          setNewNotebookDescription("");
          if (newNotebookId) { // Optionally select the newly created notebook
            onSelectNotebook(newNotebookId);
          }
        } catch (error) {
          console.error("Failed to create notebook:", error);
        }
      }
    
      async function handleDeleteNotebook(notebookId: Id<"notebooks">) {
        if (window.confirm("Are you sure you want to delete this notebook and all its notes?")) {
          try {
            await deleteNotebook({ notebookId });
            // If the deleted notebook was selected, App.tsx's selectedNotebookId will become invalid.
            // Consider how to handle this - perhaps onSelectNotebook(null) if it was selected,
            // but App.tsx currently doesn't pass down which one is selected to this component.
            // For now, deletion just removes it. The parent view (App.tsx) will handle if the
            // currently selected one is deleted (e.g. by it not being found in listNotebooks anymore).
          } catch (error) {
            console.error("Failed to delete notebook:", error);
          }
        }
      }
    
      if (notebooks === undefined) {
        return <div className="text-center p-4 text-brand-grey dark:text-dark-text-secondary">Loading notebooks...</div>;
      }
    
      return (
        // Removed the outer grid structure as this component is now focused on the list and creation form
        <div className="bg-white dark:bg-dark-surface p-4 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-brand-tertiary dark:text-brand-primary">My Notebooks</h2>
          <form onSubmit={(event) => { void handleCreateNotebook(event); }} className="mb-6 space-y-3">
            <div>
              <input
                type="text"
                value={newNotebookTitle}
                onChange={(e) => setNewNotebookTitle(e.target.value)}
                placeholder="New notebook title"
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded focus:ring-brand-primary focus:border-brand-primary bg-white dark:bg-slate-800 dark:text-white"
                required
              />
            </div>
            <div>
              <textarea
                value={newNotebookDescription}
                onChange={(e) => setNewNotebookDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded focus:ring-brand-primary focus:border-brand-primary bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-brand-primary hover:bg-brand-tertiary text-white font-semibold py-2 px-4 rounded transition duration-150 ease-in-out"
              disabled={!newNotebookTitle.trim()}
            >
              Create Notebook
            </button>
          </form>
          {notebooks.length === 0 && !newNotebookTitle && (
            <p className="text-brand-grey dark:text-dark-text-secondary">No notebooks yet. Create one to get started!</p>
          )}
          <ul className="space-y-2">
            {notebooks.map((notebook) => (
              <li
                key={notebook._id}
                className="p-3 rounded-md cursor-pointer transition-all ease-in-out duration-150 flex justify-between items-center group bg-slate-50 dark:bg-slate-700 hover:bg-brand-secondary/70 dark:hover:bg-brand-secondary/20"
                onClick={() => onSelectNotebook(notebook._id)}
              >
                <div>
                  <h3 className="font-medium text-brand-grey dark:text-dark-text">{notebook.title}</h3>
                  {notebook.description && <p className="text-sm text-slate-600 dark:text-slate-400">{notebook.description}</p>}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); 
                    void handleDeleteNotebook(notebook._id);
                  }}
                  className="text-brand-red hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="Delete notebook"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    }
