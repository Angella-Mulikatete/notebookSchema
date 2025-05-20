'use client'

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { LocalizedDate } from "../utils/DateHelper";

export default function NotebookList() {
  const notebooks: Doc<"notebooks">[] = useQuery(api.notebooks.listNotebooks) ?? [];
  const createNotebook = useMutation(api.notebooks.createNotebooks);
  const currentUser = useQuery(api.notebooks.getCurrentUser);
  const [selectedNotebook, setSelectedNotebook] = useState<Id<"notebooks"> | null>(null);
  const notes = useQuery(
    api.notebooks.listNotesByNoteBook,
    selectedNotebook ? { notebookId: selectedNotebook } : "skip"
  ) ?? [];

  const [newNotebook, setNewNotebook] = useState({ title: "", description: "" });

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotebook.title.trim()) return;

    if (!currentUser) {
      console.error("User not authenticated.");
      return;
    }

    await createNotebook({
      title: newNotebook.title,
      description: newNotebook.description,
      userId: currentUser as Id<"user">,
    });
    setNewNotebook({ title: "", description: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-playfair font-bold text-foreground">Notebooks</h2>
      </div>

      <form onSubmit={handleCreateNotebook} className="space-y-4 p-6 bg-card rounded-lg border border-border shadow-sm">
        <input
          type="text"
          value={newNotebook.title}
          onChange={(e) => setNewNotebook(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Notebook title..."
          className="input-field"
        />
        <input
          type="text"
          value={newNotebook.description}
          onChange={(e) => setNewNotebook(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Description (optional)..."
          className="input-field"
        />
        <button
          type="submit"
          disabled={!newNotebook.title.trim()}
          className="w-full px-4 py-2 text-primary-foreground bg-brand-primary rounded-lg hover:bg-brand-tertiary disabled:opacity-50 transition-colors"
        >
          Create Notebook
        </button>
      </form>

      <div className="grid gap-4">
        {notebooks.map((notebook) => (
          <div
            key={notebook._id}
            className={`bg-card border rounded-lg transition-colors shadow-sm ${
              selectedNotebook === notebook._id ?
              "border-brand-primary bg-brand-secondary/50" :
              "border-border hover:border-brand-primary"
            }`}
          >
            <div
              className="p-6 cursor-pointer"
              onClick={() => setSelectedNotebook(
                selectedNotebook === notebook._id ? null : notebook._id
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-foreground">{notebook.title}</h3>
                <span className="text-xs text-muted-foreground">
                  {/* {new Date(notebook.updatedAt).toLocaleDateString()} */}
                    {new Date(notebook.updatedAt).toISOString().slice(0, 10)}
                    {/* <LocalizedDate timestamp={notebook.updatedAt} /> */}

                </span>
              </div>
              {notebook.description && (
                <p className="text-sm text-muted-foreground mb-2">{notebook.description}</p>
              )}
            </div>

            {selectedNotebook === notebook._id && (
              <div className="border-t border-border p-6 space-y-4">
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div key={note._id} className="p-4 bg-background border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-foreground">{note.title}</h4>
                        <span className="text-xs text-muted-foreground">
                          {/* {new Date(note.updatedAt).toLocaleDateString()} */}
                            {new Date(notebook.updatedAt).toISOString().slice(0, 10)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
