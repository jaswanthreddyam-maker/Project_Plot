import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AIAssistantBoundary } from "@/components/ai/AIAssistantBoundary";

export const metadata: Metadata = {
  title: "Plot — Parallel Multi-LLM Workspace",
  description:
    "Send a single prompt to multiple AI models simultaneously. Compare responses from OpenAI, Gemini, Claude, Grok, and Ollama side by side.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-gray-900 antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <AIAssistantBoundary />
      </body>
    </html>
  );
}

