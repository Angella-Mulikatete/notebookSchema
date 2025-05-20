import { Id } from "../convex/_generated/dataModel";

    interface StudioPanelProps {
      notebookId: Id<"notebooks">;
    }

    export default function StudioPanel({ notebookId }: StudioPanelProps) {
      return (
        <div className="h-full flex flex-col p-4">
          <h2 className="text-xl font-semibold mb-4 text-slate-700 dark:text-dark-text">Studio</h2>
          
          <div className="mb-6 p-3 border dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-700/30">
            <h3 className="font-medium text-slate-700 dark:text-dark-text-secondary mb-1">Audio Overview</h3>
            <button className="text-sm text-brand-primary hover:underline mb-1">Create an Audio Overview in more languages</button>
            <button className="w-full text-sm bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 py-1.5 px-3 rounded mb-1">
              Click to load the conversation (Load)
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">Interactive mode (BETA)</p>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-slate-700 dark:text-dark-text-secondary">Notes</h3>
              <button className="text-sm text-brand-primary hover:underline">+ Add note</button>
            </div>
            {/* Placeholder for notes list */}
            <p className="text-xs text-slate-400 dark:text-slate-500">Notes related to this context will appear here.</p>
          </div>

          <div className="space-y-2 mb-6">
            {["Study guide", "FAQ", "Briefing doc", "Timeline"].map(item => (
              <button key={item} className="w-full text-left text-sm p-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600/50 rounded">
                {item}
              </button>
            ))}
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Quick Access/Prompts:</h4>
            <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <li>Modern Complex Tech Practices Explained</li>
              <li>Modern Tech Practices: IaC, QA, AI, and Deployment</li>
            </ul>
          </div>

          {/* This is a placeholder. Actual content will be dynamic. */}
          <p className="mt-auto text-xs text-slate-400 dark:text-slate-500">
            Studio panel for notebook: {notebookId.substring(0,6)}...
          </p>
        </div>
      );
    }
