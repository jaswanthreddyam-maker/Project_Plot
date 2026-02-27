/**
 * API Route - /api/vault/verify-otp
 *
 * Verifies OTP using database-backed state and invalidates OTP after use.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const MAX_ATTEMPTS = 5;
const OTP_SECRET = process.env.OTP_SECRET || "";

function normalizeEmail(value: unknown): string {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hashOtp(email: string, otp: string): string {
    return crypto
        .createHmac("sha256", OTP_SECRET)
        .update(`${email}:${otp}`)
        .digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
    try {
        const left = Buffer.from(a, "hex");
        const right = Buffer.from(b, "hex");
        if (left.length !== right.length) return false;
        return crypto.timingSafeEqual(left, right);
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    try {
        if (!OTP_SECRET) {
            return NextResponse.json(
                { error: "OTP secret is not configured on the server." },
                { status: 500 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const email = normalizeEmail(body?.email);
        const otp = typeof body?.otp === "string" ? body.otp.trim() : "";

        if (!email || !otp) {
            return NextResponse.json(
                { error: "Email and OTP are required" },
                { status: 400 }
            );
        }

        if (!/^\d{6}$/.test(otp)) {
            return NextResponse.json(
                { error: "OTP must be a 6-digit code" },
                { status: 400 }
            );
        }

        const record = await prisma.vaultOtp.findUnique({
            where: { email },
            select: {
                email: true,
                otpHash: true,
                expiresAt: true,
                attempts: true,
                usedAt: true,
            },
        });

        if (!record || record.usedAt) {
            return NextResponse.json(
                { error: "No OTP found. Please request a new one." },
                { status: 400 }
            );
        }

        if (Date.now() > record.expiresAt.getTime()) {
            await prisma.vaultOtp.deleteMany({ where: { email } });
            return NextResponse.json(
                { error: "OTP expired. Please request a new one." },
                { status: 400 }
            );
        }

        if (record.attempts >= MAX_ATTEMPTS) {
            await prisma.vaultOtp.deleteMany({ where: { email } });
            return NextResponse.json(
                { error: "Too many invalid attempts. Please request a new OTP." },
                { status: 400 }
            );
        }

        const incomingHash = hashOtp(email, otp);
        if (!safeEqualHex(record.otpHash, incomingHash)) {
            const nextAttempts = record.attempts + 1;

            if (nextAttempts >= MAX_ATTEMPTS) {
                await prisma.vaultOtp.deleteMany({ where: { email } });
                return NextResponse.json(
                    { error: "Too many invalid attempts. Please request a new OTP." },
                    { status: 400 }
                );
            }

            await prisma.vaultOtp.update({
                where: { email },
                data: { attempts: nextAttempts },
            });

            return NextResponse.json(
                { error: "Invalid OTP. Please try again." },
                { status: 400 }
            );
        }

        await prisma.vaultOtp.update({
            where: { email },
            data: { usedAt: new Date() },
        });

        return NextResponse.json({
            success: true,
            message: "OTP verified successfully",
        });
    } catch (err) {
        console.error("[/api/vault/verify-otp] Error:", err);
        return NextResponse.json(
            { error: "Verification failed" },
            { status: 500 }
        );
    }
}
