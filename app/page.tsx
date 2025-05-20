'use client'

import { SignInButton, UserButton } from "@clerk/nextjs";
import { Unauthenticated, Authenticated, AuthLoading } from "convex/react";
import { Content } from "next/font/google";
import Image from "next/image";
import NotebookList from "./components/NotebookList";
import DocumentList from "./components/DocumentList";
import { SignInForm } from "./components/SignInForm";
import { Providers } from "./providers";

export default function Home() {
  return (
  
      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
        {/* <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
      <Authenticated>
        <UserButton />
        <NotebookList />
      </Authenticated>
      <AuthLoading>
        <p>Still loading</p>
      </AuthLoading> */}
        {/* <NotebookList />
    <DocumentList/> */}

        <Authenticated>
          <p className="text-xl text-muted-foreground font-poppins">
            Organize your documents and thoughts
          </p>
        </Authenticated>
        <Unauthenticated>
          <p className="text-xl text-muted-foreground font-poppins">Sign in to get started</p>
        </Unauthenticated>

        <Unauthenticated>
          <div className="max-w-md mx-auto">
            <SignInForm />
          </div>
        </Unauthenticated>

        <Authenticated>
          <div className="grid lg:grid-cols-2 gap-8">
            <DocumentList />
            <NotebookList />
          </div>
        </Authenticated>
      </div>
   
  );
}
