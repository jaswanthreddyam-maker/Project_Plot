/**
 * Referee API Route - /api/chat/referee
 *
 * Builds a consolidated summary from multiple model responses.
 * Optionally persists the summary back to all messages in the
 * same batch, plus a dedicated "referee" assistant message.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ProviderManager } from "@/core/providers/manager";
import { ProviderName, StreamMessage } from "@/core/providers/types";
import { getAuthenticatedUserId } from "@/lib/serverAuth";

type RefereeCandidate = Extract<ProviderName, "openai" | "gemini" | "claude" | "grok">;

const REFEREE_PRIORITY: RefereeCandidate[] = ["gemini", "openai", "claude", "grok"];

const REFEREE_SYSTEM_PROMPT = `You are a neutral referee agent evaluating parallel AI responses for the same user prompt.

Write your evaluation as a short, flowing comparison in clean prose. Do not use markdown headers, bullet points, or bold text. No #, *, or - symbols.

Start by naming which response is strongest and why in one or two sentences. Then describe the key differences between the responses in a brief paragraph. If any response contains errors, gaps, or inaccuracies, mention them naturally. Close with a clear one-line recommendation on which response the user should prefer.

Keep the entire summary under 150 words. Be specific, evidence-based, and direct. If responses are nearly identical, say so plainly.`;

const TECH_LEAD_SYSTEM_PROMPT = `You are a Senior Tech Lead reviewing parallel AI-generated code fixes for the same bug or error.

Write your review as a short, flowing comparison in clean prose. Do not use markdown headers, bullet points, or bold text. No #, *, or - symbols.

Open by identifying the strongest fix and briefly explain why it wins on correctness, performance, or readability. Then compare the approaches in a short paragraph, highlighting meaningful differences. Call out any bugs, edge cases, or potential issues you spot in the proposed fixes. End with a clear one-line recommendation on which fix to adopt.

Keep the entire review under 150 words. Be specific, actionable, and direct.`;

interface ModelResponse {
    provider: string;
    content: string;
}

interface RefereeRequestBody {
    prompt?: string;
    responses?: ModelResponse[];
    apiKeys?: Record<string, string>;
    refereeProvider?: string;
    conversationId?: string;
    batchId?: string;
    apiKey?: string;
    summarizer?: string;
    codeMentorMode?: boolean;
}

function normalizeResponses(value: unknown): ModelResponse[] {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            const row = item as Partial<ModelResponse>;
            const provider = typeof row.provider === "string" ? row.provider.trim() : "";
            const content = typeof row.content === "string" ? row.content.trim() : "";
            if (!provider || !content) return null;
            return { provider, content };
        })
        .filter((row): row is ModelResponse => row !== null);
}

function extractProvider(
    body: RefereeRequestBody,
    apiKeys: Record<string, string>
): { provider: RefereeCandidate; apiKey: string } | null {
    const requested = (body.refereeProvider || body.summarizer || "").trim();
    if (
        requested &&
        REFEREE_PRIORITY.includes(requested as RefereeCandidate) &&
        apiKeys[requested]
    ) {
        return {
            provider: requested as RefereeCandidate,
            apiKey: apiKeys[requested],
        };
    }

    if (body.apiKey && requested && REFEREE_PRIORITY.includes(requested as RefereeCandidate)) {
        return {
            provider: requested as RefereeCandidate,
            apiKey: body.apiKey,
        };
    }

    if (body.apiKey) {
        return {
            provider: REFEREE_PRIORITY[0],
            apiKey: body.apiKey,
        };
    }

    for (const provider of REFEREE_PRIORITY) {
        const key = apiKeys[provider];
        if (key) {
            return { provider, apiKey: key };
        }
    }

    return null;
}

async function streamToText(stream: ReadableStream<string>): Promise<string> {
    const reader = stream.getReader();
    let combined = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        combined += value;
    }

    return combined.trim();
}

function looksLikeProviderError(summary: string): boolean {
    const value = summary.trim();
    const warningSign = String.fromCodePoint(0x26a0);
    return (
        value.startsWith(warningSign) ||
        value.startsWith("âš") ||
        value.startsWith("ERROR:") ||
        value.startsWith("Error:") ||
        value.startsWith("WARNING:") ||
        value.includes(" Error:")
    );
}

async function fetchResponsesFromBatch(
    conversationId: string,
    batchId: string,
    userId: string
): Promise<ModelResponse[]> {
    const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId },
        select: { id: true },
    });

    if (!conversation) return [];

    const rows = await prisma.message.findMany({
        where: {
            conversationId,
            batchId,
            role: "assistant",
            provider: { notIn: ["referee", "verdict"] },
        },
        orderBy: { createdAt: "asc" },
        select: { provider: true, content: true },
    });

    return rows
        .map((row) => ({
            provider: row.provider.trim(),
            content: row.content.trim(),
        }))
        .filter((row) => row.provider.length > 0 && row.content.length > 0);
}

async function persistSummaryIfPossible(
    userId: string | undefined,
    conversationId: string | undefined,
    batchId: string | undefined,
    summary: string
): Promise<boolean> {
    if (!userId || !conversationId || !batchId || !summary) {
        return false;
    }

    const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId },
        select: { id: true },
    });

    if (!conversation) return false;

    await prisma.message.updateMany({
        where: {
            conversationId,
            batchId,
            role: "assistant",
            provider: { notIn: ["referee", "verdict"] },
        },
        data: { refereeSummary: summary },
    });

    const existingReferee = await prisma.message.findFirst({
        where: {
            conversationId,
            batchId,
            provider: "referee",
        },
        select: { id: true },
    });

    if (existingReferee) {
        await prisma.message.update({
            where: { id: existingReferee.id },
            data: {
                role: "assistant",
                content: summary,
                refereeSummary: summary,
            },
        });
    } else {
        await prisma.message.create({
            data: {
                conversationId,
                role: "assistant",
                provider: "referee",
                batchId,
                content: summary,
                refereeSummary: summary,
            },
        });
    }

    await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
    });

    return true;
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as RefereeRequestBody;
        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        const apiKeys = body.apiKeys ?? {};

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        const userId = await getAuthenticatedUserId(req);

        let responses = normalizeResponses(body.responses);
        if (responses.length === 0 && body.conversationId && body.batchId && userId) {
            responses = await fetchResponsesFromBatch(body.conversationId, body.batchId, userId);
        }

        if (responses.length < 2) {
            return NextResponse.json(
                { error: "At least two AI responses are required for referee comparison." },
                { status: 400 }
            );
        }

        const referee = extractProvider(body, apiKeys);
        if (!referee) {
            return NextResponse.json(
                { error: "No API key found for any referee provider." },
                { status: 400 }
            );
        }

        const comparisonBlock = responses
            .map(
                (response) =>
                    `### ${response.provider.toUpperCase()} RESPONSE\n${response.content}`
            )
            .join("\n\n---\n\n");

        const systemPrompt = body.codeMentorMode
            ? TECH_LEAD_SYSTEM_PROMPT
            : REFEREE_SYSTEM_PROMPT;

        const refereeMessages: StreamMessage[] = [
            { role: "system", content: systemPrompt },
            {
                role: "user",
                content: `Original prompt:\n"${prompt}"\n\nModel responses:\n\n${comparisonBlock}`,
            },
        ];

        const manager = new ProviderManager();
        manager.registerProvider(referee.provider, referee.apiKey);

        const summaryStream = await manager.streamFromProvider(
            referee.provider,
            refereeMessages,
            { temperature: 0.2, maxTokens: 1200 }
        );

        const summary = await streamToText(summaryStream);
        if (!summary) {
            return NextResponse.json(
                { error: "Referee returned an empty summary." },
                { status: 502 }
            );
        }

        if (looksLikeProviderError(summary)) {
            return NextResponse.json({ error: summary }, { status: 502 });
        }

        const persisted = await persistSummaryIfPossible(
            userId || undefined,
            body.conversationId,
            body.batchId,
            summary
        );

        return NextResponse.json({
            summary,
            refereeProvider: referee.provider,
            comparedResponses: responses.length,
            persisted,
        });
    } catch (err) {
        console.error("[/api/chat/referee] Error:", err);
        return NextResponse.json(
            { error: "Failed to generate referee summary." },
            { status: 500 }
        );
    }
}
