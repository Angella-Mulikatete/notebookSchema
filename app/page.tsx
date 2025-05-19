'use client'

import { SignInButton, UserButton } from "@clerk/nextjs";
import { Unauthenticated, Authenticated, AuthLoading } from "convex/react";
import { Content } from "next/font/google";
import Image from "next/image";
import NotebookList from "./components/NotebookList";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
       <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
      <Authenticated>
        <UserButton />
        <NotebookList />
      </Authenticated>
      <AuthLoading>
        <p>Still loading</p>
      </AuthLoading>
    
    </div>
  );
}
