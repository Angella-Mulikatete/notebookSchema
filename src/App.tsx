import { Authenticated, Unauthenticated, useQuery } from "convex/react";
    import { api } from "../convex/_generated/api";
    import { SignInForm } from "./SignInForm";
    import { SignOutButton } from "./SignOutButton";
    import { Toaster } from "sonner";
    import NotebooksView from "./NotebooksView";
    import KolaAcademyMainView from "./KolaAcademyMainView"; // New Main View
    import { useState } from "react";
    import { Id } from "../convex/_generated/dataModel";
    
    // App component: Main entry point for the application UI.
    export default function App() {
      const [selectedNotebookId, setSelectedNotebookId] = useState<Id<"notebooks"> | null>(null);
      const loggedInUser = useQuery(api.auth.loggedInUser); 

      const handleClearSelectedNotebook = () => {
        setSelectedNotebookId(null);
      };

      if (loggedInUser === undefined) { 
        return (
          <div className="dark:bg-dark-background min-h-screen flex justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
          </div>
        );
      }
    
      return (
        <div className="min-h-screen flex flex-col dark:bg-dark-background dark:text-dark-text">
          <Unauthenticated>
            <header className="sticky top-0 z-10 bg-white/80 dark:bg-dark-surface/80 backdrop-blur-sm p-4 flex justify-between items-center border-b dark:border-slate-700">
              <h2 className="text-xl font-semibold text-brand-primary">Kola Academy</h2>
            </header>
            <main className="flex-1 p-8 flex flex-col items-center justify-center">
              <div className="text-center mb-8">
                <h1 className="text-5xl font-bold text-brand-primary mb-4">Welcome to Kola Academy</h1>
                <p className="text-xl text-brand-grey dark:text-dark-text-secondary">Sign in to manage your notes.</p>
              </div>
              <SignInForm />
            </main>
          </Unauthenticated>

          <Authenticated>
            {selectedNotebookId ? (
              <KolaAcademyMainView notebookId={selectedNotebookId} onExitNotebook={handleClearSelectedNotebook} />
            ) : (
              <>
                <header className="sticky top-0 z-10 bg-white/80 dark:bg-dark-surface/80 backdrop-blur-sm p-4 flex justify-between items-center border-b dark:border-slate-700">
                  <h2 className="text-xl font-semibold text-brand-primary">Kola Academy</h2>
                  <SignOutButton />
                </header>
                <main className="flex-1 p-8 bg-brand-secondary/30 dark:bg-dark-background">
                  <div className="w-full max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                      <h1 className="text-4xl font-bold text-brand-primary dark:text-brand-primary mb-2">Your Notebooks</h1>
                      <p className="text-lg text-brand-grey dark:text-dark-text-secondary">
                        Welcome back, {loggedInUser?.name ?? loggedInUser?.email ?? "friend"}!
                      </p>
                    </div>
                    <NotebooksView onSelectNotebook={setSelectedNotebookId} />
                  </div>
                </main>
              </>
            )}
          </Authenticated>
          <Toaster richColors theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'} />
        </div>
      );
    }
