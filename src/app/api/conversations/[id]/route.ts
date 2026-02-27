/**
 * Conversation API - /api/conversations/[id]
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const deleted = await prisma.conversation.deleteMany({
            where: {
                id,
                userId: session.user.id,
            },
        });

        if (deleted.count === 0) {
            return NextResponse.json(
                { error: "Conversation not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[Conversation DELETE]", err);
        return NextResponse.json(
            { error: "Failed to delete conversation" },
            { status: 500 }
        );
    }
}

