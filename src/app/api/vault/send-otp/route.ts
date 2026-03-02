/**
 * API Route - /api/vault/send-otp
 *
 * Stores OTP state in the database (Prisma) and emails the OTP.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import * as nodemailer from "nodemailer";
import prisma from "@/lib/prisma";

const OTP_TTL_MS = 5 * 60 * 1000;
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

async function cleanExpiredOtps() {
    await prisma.vaultOtp.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: new Date() } },
                { usedAt: { not: null } },
            ],
        },
    });
}

export async function POST(req: NextRequest) {
    try {
        if (!OTP_SECRET) {
            return NextResponse.json(
                { error: "OTP secret is not configured on the server." },
                { status: 500 }
            );
        }

        let body: { email?: unknown } = {};
        try {
            body = (await req.json()) as { email?: unknown };
        } catch {}
        const email = normalizeEmail(body?.email);

        if (!email || !email.includes("@")) {
            return NextResponse.json(
                { error: "Valid email is required" },
                { status: 400 }
            );
        }

        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        if ((!smtpUser || !smtpPass) && process.env.NODE_ENV === "production") {
            return NextResponse.json(
                { error: "Email delivery is not configured on the server." },
                { status: 500 }
            );
        }

        const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
        const otpHash = hashOtp(email, otp);
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);

        await cleanExpiredOtps().catch(() => undefined);

        await prisma.vaultOtp.upsert({
            where: { email },
            create: {
                email,
                otpHash,
                expiresAt,
                attempts: 0,
                usedAt: null,
            },
            update: {
                otpHash,
                expiresAt,
                attempts: 0,
                usedAt: null,
            },
        });

        if (!smtpUser || !smtpPass) {
            return NextResponse.json({
                success: true,
                message: "OTP generated for local development (SMTP not configured).",
                devMode: true,
                otp,
            });
        }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        try {
            await transporter.sendMail({
                from: `"Plot" <${smtpUser}>`,
                to: email,
                subject: "Plot - Vault Password Reset OTP",
                html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a; margin-bottom: 8px;">Vault Password Reset</h2>
          <p style="color: #666; font-size: 14px;">
            Use the following OTP to reset your Plot vault password:
          </p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1a1a1a;">
              ${otp}
            </span>
          </div>
          <p style="color: #999; font-size: 12px;">
            This OTP expires in 5 minutes. If you did not request this, ignore this email.
          </p>
        </div>
      `,
            });
        } catch (mailErr) {
            await prisma.vaultOtp.deleteMany({ where: { email } }).catch(() => undefined);
            console.error("[/api/vault/send-otp] Email send failed:", mailErr);
            return NextResponse.json(
                { error: "Failed to deliver OTP email" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "OTP sent to your email",
        });
    } catch (err) {
        console.error("[/api/vault/send-otp] Error:", err);
        return NextResponse.json(
            { error: "Failed to send OTP" },
            { status: 500 }
        );
    }
}
