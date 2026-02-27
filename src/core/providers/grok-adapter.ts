/**
 * xAI Grok streaming adapter.
 */

import OpenAI from "openai";
import { LLMAdapter, StreamMessage, StreamOptions } from "./types";

export class GrokAdapter implements LLMAdapter {
    private client: OpenAI;

    constructor(apiKey: string) {
        this.client = new OpenAI({
            apiKey,
            baseURL: "https://api.x.ai/v1",
        });
    }

    async stream(
        messages: StreamMessage[],
        options?: StreamOptions
    ): Promise<ReadableStream<string>> {
        const model = options?.model || "grok-2-latest";
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

            return new ReadableStream<string>({
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
                        const message =
                            err instanceof Error ? err.message : "Unknown Grok error";
                        controller.enqueue(`\n\n⚠️ Grok Error: ${message}`);
                        controller.close();
                    }
                },
            });
        } catch (err) {
            const error = err as { status?: number; message?: string };

            return new ReadableStream({
                start(controller) {
                    let message = "Failed to connect to Grok.";

                    if (error.status === 401) {
                        message = "Invalid Grok API key.";
                    } else if (error.status === 429) {
                        message = "Grok rate limit exceeded. Please try again later.";
                    } else if (error.status === 404) {
                        message = `Grok model "${model}" not found.`;
                    } else if (error.message) {
                        message = `Grok Error: ${error.message}`;
                    }

                    controller.enqueue(`⚠️ ${message}`);
                    controller.close();
                },
            });
        }
    }
}

