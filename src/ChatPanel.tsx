import { useQuery, useAction } from "convex/react";
    import { api } from "../convex/_generated/api";
    import { Id } from "../convex/_generated/dataModel";
    import { FormEvent, useState, useEffect, useRef } from "react";

    interface ChatPanelProps {
      notebookId: Id<"notebooks">;
    }

    export default function ChatPanel({ notebookId }: ChatPanelProps) {
      const messages = useQuery(api.chat.listMessages, notebookId ? { notebookId } : "skip") || [];
      const sendMessageAction = useAction(api.chat.sendMessage);
      const [newMessage, setNewMessage] = useState("");
      const [isSending, setIsSending] = useState(false);
      const messagesEndRef = useRef<HTMLDivElement>(null);

      const notebook = useQuery(api.notebooks.listNotebooks)?.find(nb => nb._id === notebookId);
      const sourcesCount = useQuery(api.documents.listDocuments, {})?.length || 0; // Placeholder for actual sources linked to notebook

      useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages]);

      const handleSendMessage = async (event: FormEvent) => {
        event.preventDefault();
        if (!newMessage.trim() || isSending) return;
        setIsSending(true);
        try {
          await sendMessageAction({ notebookId, userQuery: newMessage });
          setNewMessage("");
        } catch (error) {
          console.error("Failed to send message:", error);
          // Handle error (e.g., show toast)
        } finally {
          setIsSending(false);
        }
      };

      return (
        <div className="flex flex-col h-full p-4">
          <div className="mb-4 text-center border-b dark:border-slate-700 pb-4">
            <h2 className="text-2xl font-semibold text-slate-800 dark:text-dark-text">
              {/* Crane Icon Placeholder */}
              <span role="img" aria-label="Topic icon" className="mr-2">⚙️</span>
              {notebook?.title ?? "Chat"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{sourcesCount} sources</p>
          </div>

          {/* Placeholder for summary text block & buttons */}
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-md text-sm text-slate-600 dark:text-slate-300">
            This is a placeholder for the summary or introduction to the topic. It will discuss managing complexity, QA, IaC, and CI/CD pipelines.
          </div>
          <div className="mb-4 flex space-x-2">
            <button className="text-xs bg-brand-secondary dark:bg-brand-tertiary/50 text-brand-primary dark:text-brand-secondary py-1 px-2 rounded hover:opacity-80">Save to note</button>
            <button className="text-xs bg-slate-200 dark:bg-slate-600 py-1 px-2 rounded hover:opacity-80">Add note</button>
            <button className="text-xs bg-slate-200 dark:bg-slate-600 py-1 px-2 rounded hover:opacity-80">Audio Overview</button>
            <button className="text-xs bg-slate-200 dark:bg-slate-600 py-1 px-2 rounded hover:opacity-80">Mind Map</button>
          </div>


          <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
            {messages.map((msg) => (
              <div
                key={msg._id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xl p-3 rounded-lg shadow ${
                    msg.role === "user"
                      ? "bg-brand-primary text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-dark-text"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(msg._creationTime).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={(event) => { void handleSendMessage(event); }} className="mt-auto border-t dark:border-slate-700 pt-4">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 ml-1">
              Suggested: How can technology leaders strategically integrate AI into core operations for efficiency and value?
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Start typing..."
                className="flex-1 p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
                disabled={isSending}
              />
              <button
                type="submit"
                className="p-3 bg-brand-primary hover:bg-brand-tertiary text-white rounded-lg disabled:opacity-50"
                disabled={!newMessage.trim() || isSending}
              >
                {/* Paper plane icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">{sourcesCount} sources</span>
            </div>
          </form>
        </div>
      );
    }
