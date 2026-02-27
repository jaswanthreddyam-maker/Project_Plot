/**
 * ════════════════════════════════════════════════════════════════
 * OpenAI Streaming Adapter
 * ════════════════════════════════════════════════════════════════
 *
 * Uses the official `openai` SDK to create a streaming chat
 * completion. The raw SSE chunks from OpenAI are decoded and
 * forwarded as plain text chunks via a TransformStream.
 *
 * Error boundary: All SDK exceptions are caught and converted
 * to user-friendly StreamError messages injected into the stream.
 */

import OpenAI from "openai";
import {
    LLMAdapter,
    StreamMessage,
    StreamOptions,
} from "./types";

export class OpenAIAdapter implements LLMAdapter {
    private client: OpenAI;

    constructor(apiKey: string) {
        this.client = new OpenAI({ apiKey });
    }

    async stream(
        messages: StreamMessage[],
        options?: StreamOptions
    ): Promise<ReadableStream<string>> {
        const model = options?.model || "gpt-4o-mini";
        const temperature = options?.temperature ?? 0.7;
        const maxTokens = options?.maxTokens ?? 4096;

        try {
            const response = await this.client.chat.completions.create({
                model,
                messages: messages.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
                temperature,
                max_tokens: maxTokens,
                stream: true,
            });

            // ── TransformStream: SSE chunks → plain text ────────
            const readable = new ReadableStream<string>({
                async start(controller) {
                    try {
                        for await (const chunk of response) {
                            const delta = chunk.choices?.[0]?.delta?.content;
                            if (delta) {
                                controller.enqueue(delta);
                            }
                        }
                        controller.close();
                    } catch (err) {
                        // Inject error into stream rather than throwing
                        const message =
                            err instanceof Error ? err.message : "Unknown OpenAI error";
                        controller.enqueue(`\n\n⚠️ OpenAI Error: ${message}`);
                        controller.close();
                    }
                },
            });

            return readable;
        } catch (err) {
            // Return a single-chunk error stream for connection failures
            return new ReadableStream({
                start(controller) {
                    const error = err as { status?: number; message?: string };
                    let message = "Failed to connect to OpenAI.";

                    if (error.status === 401) {
                        message = "Invalid OpenAI API key. Please check your settings.";
                    } else if (error.status === 429) {
                        message = "OpenAI rate limit exceeded. Please try again later.";
                    } else if (error.status === 402) {
                        message = "OpenAI quota exceeded. Please check your billing.";
                    }

                    controller.enqueue(`⚠️ ${message}`);
                    controller.close();
                },
            });
        }
    }
}
