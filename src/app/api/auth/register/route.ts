/**
 * ════════════════════════════════════════════════════════════════
 * Auth Registration API Route — /api/auth/register
 * ════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateSalt } from "@/core/security/crypto";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const email =
            typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body?.password === "string" ? body.password : "";
        const name = typeof body?.name === "string" ? body.name.trim() : "";

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        if (!email.includes("@")) {
            return NextResponse.json(
                { error: "Valid email is required" },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: "Password must be at least 8 characters" },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json(
                { error: "An account with this email already exists" },
                { status: 409 }
            );
        }

        // Hash the login password
        const passwordHash = await bcrypt.hash(password, 12);

        // Generate a cryptographic salt for PBKDF2 vault key derivation
        const salt = generateSalt();

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name: name || null,
                salt,
            },
        });

        return NextResponse.json(
            { id: user.id, email: user.email },
            { status: 201 }
        );
    } catch (err) {
        console.error("[Register API]", err);
        return NextResponse.json(
            { error: "Registration failed. Please try again." },
            { status: 500 }
        );
    }
}
