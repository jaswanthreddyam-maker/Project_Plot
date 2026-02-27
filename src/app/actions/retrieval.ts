/**
 * ════════════════════════════════════════════════════════════════
 * Server Action — RAG Retrieval Pipeline (Live pgvector)
 * ════════════════════════════════════════════════════════════════
 *
 * Encapsulates the vector similarity search for the AI assistant.
 * All database connections, embedding APIs, and search queries
 * execute strictly on the server — never exposed to the client.
 *
 * Uses Google text-embedding-004 (768 dimensions) via the
 * @google/generative-ai SDK and PostgreSQL pgvector for
 * cosine similarity search via the existing Prisma client.
 *
 * Falls back to mock data if pgvector is not available.
 */
"use server";

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface RetrievedDocument {
    content: string;
    metadata: {
        source: string;
        similarity: number;
        accessRole?: string;
    };
}

// ── Mock data for fallback when pgvector is unavailable ───────
const MOCK_DOCUMENTS: RetrievedDocument[] = [
    {
        content:
            "Plot is a parallel multi-LLM workspace application built with Next.js 16. " +
            "It allows users to send a single prompt to multiple AI providers (OpenAI, Gemini, " +
            "Claude, Grok, Ollama) simultaneously and compare responses side by side.",
        metadata: { source: "docs/overview.md", similarity: 0.95 },
    },
    {
        content:
            "The workspace features provider toggles, stacked response sets, referee summaries " +
            "for comparing outputs, and image generation fan-out grids.",
        metadata: { source: "docs/features.md", similarity: 0.88 },
    },
];

/**
 * Generates a 768-dimensional vector embedding using
 * Google text-embedding-004 via the @google/generative-ai SDK.
 */
async function generateEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured.");
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    const result = await model.embedContent(text);
    return result.embedding.values;
}

/**
 * Checks if pgvector is available in the database.
 * Caches the result to avoid repeated checks.
 */
let pgvectorAvailable: boolean | null = null;

async function isPgvectorAvailable(): Promise<boolean> {
    if (pgvectorAvailable !== null) return pgvectorAvailable;

    try {
        const result = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
            `SELECT EXISTS (
                SELECT 1 FROM pg_extension WHERE extname = 'vector'
            ) as exists`
        );
        pgvectorAvailable = result[0]?.exists === true;
    } catch {
        pgvectorAvailable = false;
    }

    if (!pgvectorAvailable) {
        console.warn(
            "[retrieval] pgvector extension not available. " +
            "Using mock data. Run the migration SQL to enable live retrieval."
        );
    }

    return pgvectorAvailable;
}

/**
 * Performs cosine similarity search against the documents table
 * using the match_documents PostgreSQL function.
 */
async function matchDocuments(
    queryEmbedding: number[],
    topK: number,
    threshold: number = 0.7,
    metadataFilter: Record<string, unknown> = {}
): Promise<RetrievedDocument[]> {
    const embeddingStr = `[${queryEmbedding.join(",")}]`;
    const filterStr = JSON.stringify(metadataFilter);

    const rows = await prisma.$queryRawUnsafe<
        { content: string; similarity: number; source: string | null }[]
    >(
        `SELECT content, similarity, metadata->>'source' as source 
         FROM match_documents($1::halfvec(3072), $2, $3, $4::jsonb)`,
        embeddingStr,
        threshold,
        topK,
        filterStr
    );

    return rows.map((row) => ({
        content: row.content,
        metadata: {
            source: row.source ?? "unknown",
            similarity: row.similarity,
        },
    }));
}

/**
 * Public retrieval function — the entry point called by the AI agent.
 * Generates an embedding for the query and searches for relevant docs.
 * Falls back to mock data if pgvector is unavailable.
 */
export async function retrieveDocuments(
    query: string,
    topK: number = 5
): Promise<RetrievedDocument[]> {
    try {
        console.log(`[retrieval] Searching for: "${query}"`);

        // Check if pgvector is available
        const hasVectors = await isPgvectorAvailable();
        if (!hasVectors) {
            console.log("[retrieval] Returning mock data (pgvector not available)");
            return MOCK_DOCUMENTS.slice(0, topK);
        }

        // 1. Generate embedding for the query
        const embedding = await generateEmbedding(query);

        // 2. Perform similarity search
        const documents = await matchDocuments(embedding, topK);

        console.log(`[retrieval] Found ${documents.length} relevant documents`);

        // If no real documents found, fall back to mocks
        if (documents.length === 0) {
            console.log("[retrieval] No documents in pgvector table, returning mocks");
            return MOCK_DOCUMENTS.slice(0, topK);
        }

        return documents;
    } catch (error) {
        console.error("[retrieval] Error during document retrieval:", error);
        // Graceful fallback to mocks on any error
        return MOCK_DOCUMENTS.slice(0, topK);
    }
}
