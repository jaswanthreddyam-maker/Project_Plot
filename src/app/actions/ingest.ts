/**
 * ════════════════════════════════════════════════════════════════
 * Server Action — Document Ingestion for pgvector RAG
 * ════════════════════════════════════════════════════════════════
 *
 * Inserts documents into the pgvector documents table by:
 * 1. Generating a 768-dim embedding via Google text-embedding-004
 * 2. Inserting the content, metadata, and embedding via Prisma raw query
 *
 * Falls back gracefully if pgvector is not available.
 */
"use server";

import prisma from "@/lib/prisma";

interface IngestResult {
    success: boolean;
    documentId?: string;
    error?: string;
}

/**
 * Generates a 768-dimensional embedding using Google text-embedding-004.
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
 * Ingests a single document into the pgvector documents table.
 */
export async function ingestDocument(
    content: string,
    metadata: Record<string, unknown> = {}
): Promise<IngestResult> {
    try {
        if (!content.trim()) {
            return { success: false, error: "Content cannot be empty." };
        }

        // Generate embedding
        const embedding = await generateEmbedding(content);
        const embeddingStr = `[${embedding.join(",")}]`;
        const metadataStr = JSON.stringify(metadata);

        // Insert into documents table
        const rows = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
            `INSERT INTO documents (content, metadata, embedding)
             VALUES ($1, $2::jsonb, $3::halfvec(3072))
             RETURNING id`,
            content,
            metadataStr,
            embeddingStr
        );

        const id = rows[0]?.id?.toString() ?? "unknown";
        console.log(`[ingest] Document inserted with id=${id}`);

        return { success: true, documentId: id };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Ingestion failed.";
        console.error("[ingest] Error:", message);
        return { success: false, error: message };
    }
}

/**
 * Ingests multiple documents in batch.
 */
export async function ingestDocuments(
    documents: { content: string; metadata?: Record<string, unknown> }[]
): Promise<{ total: number; succeeded: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let succeeded = 0;

    for (const doc of documents) {
        const result = await ingestDocument(doc.content, doc.metadata ?? {});
        if (result.success) {
            succeeded++;
        } else {
            errors.push(result.error ?? "Unknown error");
        }
    }

    console.log(`[ingest] Batch complete: ${succeeded}/${documents.length} succeeded`);

    return {
        total: documents.length,
        succeeded,
        failed: documents.length - succeeded,
        errors,
    };
}
