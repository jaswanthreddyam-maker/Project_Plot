import crypto from "crypto";
import prisma from "@/lib/prisma";

const JWT_SECRET_KEY =
    process.env.JWT_SECRET_KEY || "v-61-plot-ai-secret-key-change-me";

interface JwtPayload {
    sub?: string;
    exp?: number;
}

function decodeBase64Url(value: string): string | null {
    try {
        return Buffer.from(value, "base64url").toString("utf8");
    } catch {
        return null;
    }
}

function verifyJwtAndExtractSubject(token: string): string | null {
    if (!token) return null;

    // Backward compatibility: earlier dev tokens sometimes used raw user IDs.
    if (!token.includes(".")) {
        return token;
    }

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const headerRaw = decodeBase64Url(encodedHeader);
    const payloadRaw = decodeBase64Url(encodedPayload);
    if (!headerRaw || !payloadRaw) return null;

    let header: { alg?: string } | null = null;
    let payload: JwtPayload | null = null;
    try {
        header = JSON.parse(headerRaw) as { alg?: string };
        payload = JSON.parse(payloadRaw) as JwtPayload;
    } catch {
        return null;
    }

    if (!header || header.alg !== "HS256" || !payload?.sub) {
        return null;
    }

    const expectedSignature = crypto
        .createHmac("sha256", JWT_SECRET_KEY)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest("base64url");

    const sigA = Buffer.from(signature, "base64url");
    const sigB = Buffer.from(expectedSignature, "base64url");
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
        return null;
    }

    if (typeof payload.exp === "number") {
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp <= now) return null;
    }

    return payload.sub;
}

export async function getAuthenticatedUserId(
    request: Request
): Promise<string | null> {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
        return null;
    }

    const token = authHeader.slice(7).trim();
    const subject = verifyJwtAndExtractSubject(token);
    if (!subject) return null;

    if (subject.includes("@")) {
        const user = await prisma.user.findUnique({
            where: { email: subject.toLowerCase() },
            select: { id: true },
        });
        return user?.id || null;
    }

    return subject;
}
