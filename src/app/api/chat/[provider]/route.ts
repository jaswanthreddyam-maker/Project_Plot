/**
 * ════════════════════════════════════════════════════════════════
 * Isolated Streaming API Route — /api/chat/[provider]
 * ════════════════════════════════════════════════════════════════
 *
 * Dev mode: Accepts API key directly in the request body.
 * Production: Would use vault decryption from session JWT.
 *
 * Each provider gets its own independent HTTP stream.
 */

import { NextRequest, NextResponse } from "next/server";
import { ProviderManager } from "@/core/providers/manager";
import { ProviderName, StreamMessage } from "@/core/providers/types";

const VALID_PROVIDERS: ProviderName[] = ["openai", "gemini", "claude", "ollama", "grok"];

function normalizeMessages(value: unknown): StreamMessage[] {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            const row = item as Partial<StreamMessage>;
            const role =
                row.role === "system" || row.role === "user" || row.role === "assistant"
                    ? row.role
                    : null;
            const content = typeof row.content === "string" ? row.content : "";
            if (!role || !content.trim()) return null;
            return { role, content };
        })
        .filter((row): row is StreamMessage => row !== null);
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ provider: string }> }
) {
    try {
        const { provider: providerSlug } = await params;

        console.log(`\n[/api/chat/${providerSlug}] ─── Request received ───`);

        // ── 1. Validate provider slug ────────────────────────
        if (!VALID_PROVIDERS.includes(providerSlug as ProviderName)) {
            console.error(`[/api/chat] Invalid provider: ${providerSlug}`);
            return NextResponse.json(
                { error: `Invalid provider: ${providerSlug}` },
                { status: 400 }
            );
        }

        const provider = providerSlug as ProviderName;

        // ── 2. Parse request body ────────────────────────────
        const body = await req.json().catch(() => ({}));
        const messages = normalizeMessages(body.messages);
        const apiKey: string | undefined = body.apiKey;
        const options = body.options || {};

        console.log(`[/api/chat/${provider}] Messages: ${messages.length}`);
        console.log(`[/api/chat/${provider}] Options received`);

        if (!messages.length) {
            return NextResponse.json(
                { error: "No messages provided" },
                { status: 400 }
            );
        }

        // ── 3. Instantiate ProviderManager ───────────────────
        const manager = new ProviderManager();

        if (provider === "ollama") {
            manager.registerProvider("ollama");
        } else {
            if (!apiKey) {
                console.error(`[/api/chat/${provider}] No API key provided!`);
                return NextResponse.json(
                    { error: `No API key provided for ${provider}. Add it in Settings.` },
                    { status: 400 }
                );
            }
            manager.registerProvider(provider, apiKey);
        }

        console.log(`[/api/chat/${provider}] Provider registered, starting stream...`);

        // ── 4. Stream the response ──────────────────────────
        const stream = await manager.streamFromProvider(
            provider,
            messages,
            options
        );

        console.log(`[/api/chat/${provider}] Stream created successfully`);

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (err) {
        console.error("[/api/chat] ═══ UNHANDLED ERROR ═══");
        console.error("[/api/chat] Error:", err);
        console.error("[/api/chat] Stack:", err instanceof Error ? err.stack : "N/A");
        return NextResponse.json(
            { error: "An internal error occurred. Please try again." },
            { status: 500 }
        );
    }
}
