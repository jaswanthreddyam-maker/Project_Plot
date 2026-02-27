/**
 * ════════════════════════════════════════════════════════════════
 * Anthropic Claude Streaming Adapter
 * ════════════════════════════════════════════════════════════════
 *
 * Uses the @anthropic-ai/sdk for streaming. Claude requires
 * system messages to be passed as a top-level parameter rather
 * than in the messages array, so this adapter handles the split.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
    LLMAdapter,
    StreamMessage,
    StreamOptions,
} from "./types";

export class ClaudeAdapter implements LLMAdapter {
    private client: Anthropic;

    constructor(apiKey: string) {
        this.client = new Anthropic({ apiKey });
    }

    async stream(
        messages: StreamMessage[],
        options?: StreamOptions
    ): Promise<ReadableStream<string>> {
        const model = options?.model || "claude-sonnet-4-20250514";
        const maxTokens = options?.maxTokens ?? 4096;

        try {
            // ── Claude requires system as a top-level param ──
            const systemMessage = messages.find((m) => m.role === "system");
            const chatMessages = messages
                .filter((m) => m.role !== "system")
                .map((m) => ({
                    role: m.role as "user" | "assistant",
                    content: m.content,
                }));

            const response = await this.client.messages.create({
                model,
                max_tokens: maxTokens,
                ...(systemMessage ? { system: systemMessage.content } : {}),
                messages: chatMessages,
                stream: true,
            });

            // ── Transform Anthropic events → text chunks ──────
            return new ReadableStream<string>({
                async start(controller) {
                    try {
                        for await (const event of response) {
                            if (
                                event.type === "content_block_delta" &&
                                event.delta.type === "text_delta"
                            ) {
                                controller.enqueue(event.delta.text);
                            }
                        }
                        controller.close();
                    } catch (err) {
                        const message =
                            err instanceof Error ? err.message : "Unknown Claude error";
                        controller.enqueue(`\n\n⚠️ Claude Error: ${message}`);
                        controller.close();
                    }
                },
            });
        } catch (err) {
            return new ReadableStream({
                start(controller) {
                    const error = err as { status?: number; message?: string };
                    let message = "Failed to connect to Anthropic Claude.";

                    if (error.status === 401) {
                        message = "Invalid Claude API key. Please check your settings.";
                    } else if (error.status === 429) {
                        message = "Claude rate limit exceeded. Please try again later.";
                    } else if (error.status === 402) {
                        message = "Claude quota exceeded. Please check your billing.";
                    }

                    controller.enqueue(`⚠️ ${message}`);
                    controller.close();
                },
            });
        }
    }
}
