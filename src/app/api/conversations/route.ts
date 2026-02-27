/**
 * ════════════════════════════════════════════════════════════════
 * Conversations API — /api/conversations
 * ════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const conversations = await prisma.conversation.findMany({
            where: { userId: session.user.id },
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
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const rawTitle = typeof body?.title === "string" ? body.title : "";
        const title = rawTitle.trim().slice(0, 120) || "New Chat";

        const conversation = await prisma.conversation.create({
            data: {
                userId: session.user.id,
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

export async function DELETE() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await prisma.conversation.deleteMany({
            where: { userId: session.user.id },
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
