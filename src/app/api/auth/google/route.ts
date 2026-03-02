import { NextResponse } from "next/server";

function resolveFastApiBase(): string {
    const configured = process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
    if (configured) {
        return configured.replace(/\/+$/, "");
    }

    throw new Error("Missing API_URL (or NEXT_PUBLIC_API_URL) for FastAPI backend");
}

export async function POST(req: Request) {
    let token = "";
    try {
        const body = (await req.json()) as { token?: unknown };
        token = typeof body.token === "string" ? body.token.trim() : "";
    } catch {
        return NextResponse.json(
            { detail: "Invalid JSON payload" },
            { status: 400 }
        );
    }

    if (!token) {
        return NextResponse.json(
            { detail: "Google token is required" },
            { status: 400 }
        );
    }

    let fastapiUrl: string;
    try {
        fastapiUrl = resolveFastApiBase();
    } catch (error) {
        console.error("[Google Auth Config Error]", error);
        return NextResponse.json(
            { detail: "Backend auth service URL is not configured" },
            { status: 500 }
        );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const upstream = await fetch(`${fastapiUrl}/api/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
            signal: controller.signal,
            cache: "no-store",
        });

        const rawBody = await upstream.text();
        let payload: unknown = { detail: "Unexpected backend response" };

        if (rawBody) {
            try {
                payload = JSON.parse(rawBody) as unknown;
            } catch {
                payload = { detail: rawBody };
            }
        }

        return NextResponse.json(payload, { status: upstream.status });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            return NextResponse.json(
                { detail: "Backend Google auth request timed out" },
                { status: 504 }
            );
        }

        console.error("[Google Auth Proxy Error]", error);
        return NextResponse.json(
            { detail: "Failed to reach backend Google auth service" },
            { status: 502 }
        );
    } finally {
        clearTimeout(timeoutId);
    }
}
