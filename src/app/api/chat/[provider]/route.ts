/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * Isolated Streaming API Route â€” /api/chat/[provider]
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *
 * Dev mode: Accepts API key directly in the request body.
 * Production: Would use vault decryption from session JWT.
 *
 * Each provider gets its own independent HTTP stream.
 */

import { NextRequest, NextResponse } from "next/server";
import { ProviderManager } from "@/core/providers/manager";
import { ProviderName, StreamMessage } from "@/core/providers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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


        // â”€â”€ 1. Validate provider slug â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (!VALID_PROVIDERS.includes(providerSlug as ProviderName)) {
            console.error(`[/api/chat] Invalid provider: ${providerSlug}`);
            return NextResponse.json(
                { error: `Invalid provider: ${providerSlug}` },
                { status: 400 }
            );
        }

        const provider = providerSlug as ProviderName;

        // â”€â”€ 2. Parse request body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const body = await req.json().catch(() => ({}));
        const messages = normalizeMessages(body.messages);
        const apiKey: string | undefined = body.apiKey;
        const options = body.options || {};


        if (!messages.length) {
            return NextResponse.json(
                { error: "No messages provided" },
                { status: 400 }
            );
        }

        // â”€â”€ 3. Instantiate ProviderManager â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


        // â”€â”€ 4. Stream the response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const stream = await manager.streamFromProvider(
            provider,
            messages,
            options
        );

        const encoder = new TextEncoder();
        const reader = stream.getReader();
        const byteStream = new ReadableStream<Uint8Array>({
            async pull(controller) {
                const { done, value } = await reader.read();
                if (done) {
                    controller.close();
                    reader.releaseLock();
                    return;
                }

                if (value) {
                    controller.enqueue(encoder.encode(value));
                }
            },
            cancel() {
                reader.releaseLock();
            },
        });

        return new Response(byteStream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (err) {
        console.error("[/api/chat] â•â•â• UNHANDLED ERROR â•â•â•");
        console.error("[/api/chat] Error:", err);
        console.error("[/api/chat] Stack:", err instanceof Error ? err.stack : "N/A");
        return NextResponse.json(
            { error: "An internal error occurred. Please try again." },
            { status: 500 }
        );
    }
}
