// pages/_app.tsx
import type { AppProps } from "next/app";
import convex from "../app/lib/convex";
import { ConvexProvider } from "convex/react";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ConvexProvider client={convex}>
      <Component {...pageProps} />
    </ConvexProvider>
  );
}