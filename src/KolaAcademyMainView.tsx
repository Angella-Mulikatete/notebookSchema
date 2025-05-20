import { useState } from "react";
    import { Id } from "../convex/_generated/dataModel";
    import SourcesPanel from "./SourcesPanel";
    import ChatPanel from "./ChatPanel";
    import StudioPanel from "./StudioPanel";
    import { useQuery } from "convex/react";
    import { api } from "../convex/_generated/api";

    interface KolaAcademyMainViewProps {
      notebookId: Id<"notebooks">;
      onExitNotebook: () => void;
    }

    export default function KolaAcademyMainView({ notebookId, onExitNotebook }: KolaAcademyMainViewProps) {
      const notebook = useQuery(api.notebooks.listNotebooks)?.find(nb => nb._id === notebookId);
      // TODO: Add state for selected sources from SourcesPanel if needed for ChatPanel context

      return (
        <div className="flex flex-col h-screen dark:bg-dark-background dark:text-dark-text">
          {/* Header */}
          <header className="bg-white dark:bg-dark-surface p-3 border-b dark:border-slate-700 flex justify-between items-center shadow-sm">
            <div className="flex items-center">
              <button 
                onClick={onExitNotebook} 
                className="mr-3 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Back to notebooks"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <span className="text-sm text-brand-primary font-semibold">Plus</span>
              <span className="text-sm text-slate-500 dark:text-slate-400 mx-2">/</span>
              <h1 className="text-lg font-semibold text-slate-700 dark:text-dark-text">
                {notebook?.title ?? "Loading Notebook..."}
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              {/* Placeholder Icons */}
              <button className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700" title="Analytics"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10M18 20V4M6 20V16"/></svg></button>
              <button className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700" title="Share"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v10"/></svg></button>
              <button className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700" title="Settings"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
              {/* User Profile Avatar - Placeholder */}
              <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white text-sm font-semibold" title="User Profile">
                KA
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-px overflow-hidden bg-slate-200 dark:bg-slate-700"> {/* Use gap-px for thin borders */}
            {/* Left Sidebar: Sources Panel */}
            <div className="md:col-span-3 lg:col-span-3 bg-white dark:bg-dark-surface overflow-y-auto p-4">
              <SourcesPanel notebookId={notebookId} />
            </div>

            {/* Center Panel: Chat/Content Area */}
            <div className="md:col-span-6 lg:col-span-6 bg-white dark:bg-dark-surface flex flex-col overflow-y-auto">
              <ChatPanel notebookId={notebookId} />
            </div>

            {/* Right Sidebar: Studio Panel */}
            <div className="md:col-span-3 lg:col-span-3 bg-white dark:bg-dark-surface overflow-y-auto p-4">
              <StudioPanel notebookId={notebookId} />
            </div>
          </main>
        </div>
      );
    }
