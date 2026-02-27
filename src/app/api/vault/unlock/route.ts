/**
 * ════════════════════════════════════════════════════════════════
 * Vault Unlock API Route — /api/vault/unlock
 * ════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deriveKey, encryptFragment } from "@/core/security/crypto";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const password = typeof body?.password === "string" ? body.password : "";
        if (!password.trim()) {
            return NextResponse.json(
                { error: "Vault password is required" },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { salt: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (!user.salt) {
            return NextResponse.json(
                { error: "Vault salt is not configured for this user." },
                { status: 400 }
            );
        }

        const masterKey = process.env.SECRET_MASTER_KEY;
        if (!masterKey) {
            console.error("SECRET_MASTER_KEY is not configured");
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            );
        }

        const derivedKey = deriveKey(masterKey, password, user.salt);
        const derivedKeyHex = derivedKey.toString("hex");

        const jwtSecret =
            process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
        const unlockFragment = encryptFragment(derivedKeyHex, jwtSecret);

        return NextResponse.json({ unlockFragment });
    } catch (err) {
        console.error("[Vault Unlock]", err);
        return NextResponse.json(
            { error: "Failed to unlock vault" },
            { status: 500 }
        );
    }
}
