import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const JWT_SECRET_KEY =
    process.env.JWT_SECRET_KEY || "v-61-plot-ai-secret-key-change-me";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function issueBackendToken(subject: string): string {
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
        sub: subject,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
        .createHmac("sha256", JWT_SECRET_KEY)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest("base64url");

    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function GET() {
    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();

    if (!email) {
        return NextResponse.json(
            { detail: "Not authenticated" },
            { status: 401 }
        );
    }

    const accessToken = issueBackendToken(email);
    return NextResponse.json(
        {
            access_token: accessToken,
            token_type: "bearer",
            expires_in: TOKEN_TTL_SECONDS,
        },
        {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        }
    );
}
