/**
 * ════════════════════════════════════════════════════════════════
 * Conversations API — /api/conversations
 * ════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
    try {
        const userId = await getAuthenticatedUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const conversations = await prisma.conversation.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
            select: { id: true, title: true, updatedAt: true },
            take: 50,
        });

        return NextResponse.json({ conversations });
    } catch (err) {
        console.error("[Conversations GET]", err);
        return NextResponse.json(
            { error: "Failed to fetch conversations" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const userId = await getAuthenticatedUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const rawTitle = typeof body?.title === "string" ? body.title : "";
        const title = rawTitle.trim().slice(0, 120) || "New Chat";

        const conversation = await prisma.conversation.create({
            data: {
                userId,
                title,
            },
        });

        return NextResponse.json({ conversation }, { status: 201 });
    } catch (err) {
        console.error("[Conversations POST]", err);
        return NextResponse.json(
            { error: "Failed to create conversation" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const userId = await getAuthenticatedUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await prisma.conversation.deleteMany({
            where: { userId },
        });

        return NextResponse.json({ deleted: result.count });
    } catch (err) {
        console.error("[Conversations DELETE]", err);
        return NextResponse.json(
            { error: "Failed to clear conversations" },
            { status: 500 }
        );
    }
}
