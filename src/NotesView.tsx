import { useQuery, useMutation } from "convex/react";
    import { api } from "../convex/_generated/api";
    import { Id } from "../convex/_generated/dataModel";
    import { FormEvent, useState, useEffect } from "react";
    import { useAction } from "convex/react"; 
    
    interface NotesViewProps {
      notebookId: Id<"notebooks">;
    }
    
    export default function NotesView({ notebookId }: NotesViewProps) {
      const notes = useQuery(api.notebooks.listNotesByNotebook, notebookId ? { notebookId } : "skip") || [];
      const performCreateNote = useAction(api.notebooks.createNote);
      const deleteNote = useMutation(api.notebooks.deleteNote);
    
      const [newNoteTitle, setNewNoteTitle] = useState("");
      const [newNoteContent, setNewNoteContent] = useState("");
      const [isCreatingNote, setIsCreatingNote] = useState(false); 
    
      useEffect(() => {
        setNewNoteTitle("");
        setNewNoteContent("");
      }, [notebookId]);
    
      async function handleCreateNote(event: FormEvent) {
        event.preventDefault();
        if (!newNoteTitle.trim() || !newNoteContent.trim() || isCreatingNote) return;
        
        setIsCreatingNote(true);
        try {
          await performCreateNote({ 
            notebookId,
            title: newNoteTitle,
            content: newNoteContent,
            knowledgeEntryIds: [], 
          });
          setNewNoteTitle("");
          setNewNoteContent("");
        } catch (error) {
          console.error("Failed to create note:", error);
          alert(`Error creating note: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
          setIsCreatingNote(false);
        }
      }
    
      async function handleDeleteNote(noteId: Id<"notes">) {
        if (window.confirm("Are you sure you want to delete this note?")) {
          try {
            await deleteNote({ noteId });
          } catch (error) {
            console.error("Failed to delete note:", error);
            alert(`Error deleting note: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }
      }
      
      const notebookTitle = useQuery(api.notebooks.listNotebooks, notebookId ? undefined : "skip")?.find(nb => nb._id === notebookId)?.title;
    
    
      if (notes === undefined) {
        return <div className="text-center p-4 text-brand-grey">Loading notes...</div>;
      }
    
      return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-3xl font-semibold mb-6 text-brand-grey">
            Notes in <span className="text-brand-primary">{notebookTitle ?? "Selected Notebook"}</span>
          </h2>
          <form onSubmit={handleCreateNote} className="mb-8 p-4 border border-slate-200 rounded-md bg-slate-50 space-y-3">
            <h3 className="text-xl font-medium text-brand-tertiary">Create New Note</h3>
            <div>
              <input
                type="text"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Note title"
                className="w-full p-2 border border-slate-300 rounded focus:ring-brand-primary focus:border-brand-primary"
                required
                disabled={isCreatingNote}
              />
            </div>
            <div>
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Note content..."
                rows={4}
                className="w-full p-2 border border-slate-300 rounded focus:ring-brand-primary focus:border-brand-primary"
                required
                disabled={isCreatingNote}
              />
            </div>
            <button
              type="submit"
              className="bg-brand-primary hover:bg-brand-tertiary text-white font-semibold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50"
              disabled={!newNoteTitle.trim() || !newNoteContent.trim() || isCreatingNote}
            >
              {isCreatingNote ? "Adding Note..." : "Add Note"}
            </button>
          </form>
    
          {notes.length === 0 && !newNoteTitle && !newNoteContent && (
            <p className="text-slate-500 text-center py-4">No notes in this notebook yet. Add one!</p>
          )}
    
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note._id} className="p-4 border border-slate-200 rounded-md shadow-sm hover:shadow-md transition-shadow bg-white group">
                <div className="flex justify-between items-start">
                  <h4 className="text-xl font-semibold text-brand-grey mb-1">{note.title}</h4>
                  <button
                    onClick={() => handleDeleteNote(note._id)}
                    className="text-brand-red hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    title="Delete note"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
                <p className="text-slate-600 whitespace-pre-wrap">{note.content}</p>
                <p className="text-xs text-slate-400 mt-2">
                  Created: {new Date(note._creationTime).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    }
