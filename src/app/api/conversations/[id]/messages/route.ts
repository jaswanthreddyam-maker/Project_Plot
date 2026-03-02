/**
 * ════════════════════════════════════════════════════════════════
 * Messages API — /api/conversations/[id]/messages
 * ════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/serverAuth";

interface IncomingMessage {
    role: "user" | "assistant";
    content: string;
    provider: string;
    batchId?: string;
    refereeSummary?: string;
}

function normalizeIncomingMessages(value: unknown): IncomingMessage[] {
    if (!Array.isArray(value)) return [];

    const normalized: IncomingMessage[] = [];

    for (const item of value) {
        const row = item as Partial<IncomingMessage>;
        const role = row.role === "user" || row.role === "assistant" ? row.role : null;
        const content = typeof row.content === "string" ? row.content.trim() : "";
        const provider = typeof row.provider === "string" ? row.provider.trim() : "";
        const batchId =
            typeof row.batchId === "string" && row.batchId.trim()
                ? row.batchId.trim()
                : undefined;
        const refereeSummary =
            typeof row.refereeSummary === "string" && row.refereeSummary.trim()
                ? row.refereeSummary.trim()
                : undefined;

        if (!role || !content || !provider) continue;
        normalized.push({ role, content, provider, batchId, refereeSummary });
    }

    return normalized;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getAuthenticatedUserId(_req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const conversation = await prisma.conversation.findFirst({
            where: { id, userId },
        });

        if (!conversation) {
            return NextResponse.json(
                { error: "Conversation not found" },
                { status: 404 }
            );
        }

        const messages = await prisma.message.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json({ messages });
    } catch (err) {
        console.error("[Messages GET]", err);
        return NextResponse.json(
            { error: "Failed to fetch messages" },
            { status: 500 }
        );
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getAuthenticatedUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const conversation = await prisma.conversation.findFirst({
            where: { id, userId },
        });

        if (!conversation) {
            return NextResponse.json(
                { error: "Conversation not found" },
                { status: 404 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const messages = normalizeIncomingMessages(body?.messages);

        if (messages.length === 0) {
            return NextResponse.json(
                { error: "At least one valid message is required" },
                { status: 400 }
            );
        }

        const created = await prisma.message.createMany({
            data: messages.map(
                (m: IncomingMessage) => ({
                    conversationId: id,
                    role: m.role,
                    content: m.content,
                    provider: m.provider,
                    batchId: m.batchId || null,
                    refereeSummary: m.refereeSummary || null,
                })
            ),
        });

        await prisma.conversation.update({
            where: { id },
            data: { updatedAt: new Date() },
        });

        return NextResponse.json({ count: created.count }, { status: 201 });
    } catch (err) {
        console.error("[Messages POST]", err);
        return NextResponse.json(
            { error: "Failed to save messages" },
            { status: 500 }
        );
    }
}
