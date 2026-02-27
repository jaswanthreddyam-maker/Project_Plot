/**
 * ════════════════════════════════════════════════════════════════
 * Secrets Management API — /api/secrets
 * ════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
    encrypt,
    maskSecret,
    decryptFragment,
} from "@/core/security/crypto";

/**
 * GET /api/secrets — List all configured providers with masked keys
 */
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const secrets = await prisma.providerSecret.findMany({
            where: { userId: session.user.id },
            select: {
                id: true,
                providerName: true,
                updatedAt: true,
            },
        });

        const maskedSecrets = secrets.map((s: { id: string; providerName: string; updatedAt: Date }) => ({
            id: s.id,
            providerName: s.providerName,
            maskedKey: "••••••••••••",
            updatedAt: s.updatedAt,
        }));

        return NextResponse.json({ secrets: maskedSecrets });
    } catch (err) {
        console.error("[Secrets GET]", err);
        return NextResponse.json(
            { error: "Failed to fetch secrets" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/secrets — Save a new encrypted API key
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify vault is unlocked via JWT
        if (!(session as { isUnlocked?: boolean }).isUnlocked) {
            return NextResponse.json(
                { error: "Vault is locked. Please enter your secrets password." },
                { status: 403 }
            );
        }

        const { providerName, apiKey } = await req.json();

        if (!providerName || !apiKey) {
            return NextResponse.json(
                { error: "Provider name and API key are required" },
                { status: 400 }
            );
        }

        // Get the unlock fragment from JWT
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        const tokenCookie = cookieStore.get("__Secure-authjs.session-token") ||
            cookieStore.get("authjs.session-token");

        if (!tokenCookie?.value) {
            return NextResponse.json(
                { error: "Session token not found" },
                { status: 401 }
            );
        }

        const jwtSecret =
            process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";

        const { decode } = await import("next-auth/jwt");
        const decodedToken = await decode({
            token: tokenCookie.value,
            secret: jwtSecret,
            salt: tokenCookie.name,
        });

        if (!decodedToken?.unlockFragment) {
            return NextResponse.json(
                { error: "Vault is locked" },
                { status: 403 }
            );
        }

        const derivedKeyHex = decryptFragment(
            decodedToken.unlockFragment as string,
            jwtSecret
        );
        const derivedKey = Buffer.from(derivedKeyHex, "hex");

        // Encrypt the API key using AES-256-GCM
        const encrypted = encrypt(apiKey, derivedKey);

        await prisma.providerSecret.upsert({
            where: {
                userId_providerName: {
                    userId: session.user.id,
                    providerName,
                },
            },
            create: {
                userId: session.user.id,
                providerName,
                cipherText: encrypted.cipherText,
                iv: encrypted.iv,
                authTag: encrypted.authTag,
            },
            update: {
                cipherText: encrypted.cipherText,
                iv: encrypted.iv,
                authTag: encrypted.authTag,
            },
        });

        return NextResponse.json({
            success: true,
            maskedKey: maskSecret(apiKey),
        });
    } catch (err) {
        console.error("[Secrets POST]", err);
        return NextResponse.json(
            { error: "Failed to save API key" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/secrets — Remove a stored API key
 */
export async function DELETE(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { providerName } = await req.json();

        if (!providerName) {
            return NextResponse.json(
                { error: "Provider name is required" },
                { status: 400 }
            );
        }

        await prisma.providerSecret.deleteMany({
            where: {
                userId: session.user.id,
                providerName,
            },
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[Secrets DELETE]", err);
        return NextResponse.json(
            { error: "Failed to delete API key" },
            { status: 500 }
        );
    }
}
