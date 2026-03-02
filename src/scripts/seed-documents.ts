/**
 * Seed Script — Insert sample documents into pgvector
 *
 * Usage: npx tsx src/scripts/seed-documents.ts
 *
 * Requires pgvector extension to be installed and the
 * migration to have been applied.
 */

import { ingestDocuments } from "../app/actions/ingest";

const SAMPLE_DOCUMENTS = [
    {
        content:
            "Plot is a parallel multi-LLM workspace application built with Next.js 16. " +
            "It allows users to send a single prompt to multiple AI providers (OpenAI, Gemini, " +
            "Claude, Grok, Ollama) simultaneously and compare responses side by side.",
        metadata: { source: "docs/overview.md", category: "documentation" },
    },
    {
        content:
            "The workspace features provider toggles, stacked response sets, referee summaries " +
            "for comparing outputs, and image generation fan-out grids. Users can enable or " +
            "disable any provider at any time using the provider pills in the workspace header.",
        metadata: { source: "docs/features.md", category: "documentation" },
    },
    {
        content:
            "Plot uses Zustand for client-side state management with three isolated stores: " +
            "uiStore for interface state, chatStore for messages and response sets, and " +
            "assistantStore for the AI assistant overlay. This separation prevents state leakage " +
            "across features.",
        metadata: { source: "docs/architecture.md", category: "technical" },
    },
    {
        content:
            "The Referee Mode in Plot sends all provider responses to a designated model that " +
            "generates a comparative paragraph-based summary. The referee evaluates clarity, " +
            "accuracy, and depth of each response without using markdown formatting.",
        metadata: { source: "docs/referee.md", category: "documentation" },
    },
    {
        content:
            "Plot's Code Mentor is a full-screen split-pane workspace with Monaco Editor on the " +
            "left and structured explanations on the right. It uses a dedicated API route that " +
            "enforces JSON-structured output through Zod schema validation, preventing markdown " +
            "in the response.",
        metadata: { source: "docs/code-mentor.md", category: "documentation" },
    },
    {
        content:
            "Authentication in Plot uses backend-issued JWT bearer tokens with support for both " +
            "email/password credentials and Google OAuth. User records are stored in PostgreSQL " +
            "via Prisma ORM. Sensitive provider API keys are encrypted using AES-256-GCM before " +
            "storage.",
        metadata: { source: "docs/security.md", category: "technical" },
    },
    {
        content:
            "The Plot Vault system stores encrypted API keys for LLM providers. Keys are encrypted " +
            "client-side using a master key derived from the user's vault password via PBKDF2, then " +
            "stored in the database. Accessing the vault requires OTP verification sent via email.",
        metadata: { source: "docs/vault.md", category: "technical" },
    },
    {
        content:
            "Plot supports five LLM providers through a unified adapter pattern: OpenAI, Gemini, " +
            "Claude (Anthropic), Grok (xAI), and Ollama (local models). Each provider has its own " +
            "adapter class implementing the same streaming interface, managed by the ProviderManager.",
        metadata: { source: "docs/providers.md", category: "technical" },
    },
];

async function main() {
    console.log("Seeding documents into pgvector...\n");

    const result = await ingestDocuments(SAMPLE_DOCUMENTS);

    console.log(`\nSeed complete:`);
    console.log(`  Total:     ${result.total}`);
    console.log(`  Succeeded: ${result.succeeded}`);
    console.log(`  Failed:    ${result.failed}`);

    if (result.errors.length > 0) {
        console.log(`\nErrors:`);
        result.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }

    process.exit(0);
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
