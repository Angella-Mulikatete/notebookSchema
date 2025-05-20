'use client'

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import App from "next/app";

//const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL as string);
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string}>
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
                {children}
            </ConvexProviderWithClerk>
        </ClerkProvider>
    )
}