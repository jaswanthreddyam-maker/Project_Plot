/**
 * ════════════════════════════════════════════════════════════════
 * Ollama Local Streaming Adapter
 * ════════════════════════════════════════════════════════════════
 *
 * Streams from a locally running Ollama instance via HTTP.
 * No authentication required. Defaults to http://localhost:11434.
 *
 * Ollama uses a NDJSON streaming format — each line is a JSON
 * object with a `message.content` field for chat completions.
 */

import {
    LLMAdapter,
    StreamMessage,
    StreamOptions,
} from "./types";

export class OllamaAdapter implements LLMAdapter {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    }

    async stream(
        messages: StreamMessage[],
        options?: StreamOptions
    ): Promise<ReadableStream<string>> {
        const model = options?.model || "llama3.2";

        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model,
                    messages: messages.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                    stream: true,
                    options: {
                        temperature: options?.temperature ?? 0.7,
                        ...(options?.maxTokens ? { num_predict: options.maxTokens } : {}),
                    },
                }),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "Unknown error");
                throw new Error(`Ollama returned ${response.status}: ${errorText}`);
            }

            if (!response.body) {
                throw new Error("No response body from Ollama");
            }

            // ── Parse NDJSON stream from Ollama ─────────────────
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            return new ReadableStream<string>({
                async start(controller) {
                    try {
                        let buffer = "";

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });

                            // Process complete JSON lines
                            const lines = buffer.split("\n");
                            buffer = lines.pop() || ""; // Keep incomplete line in buffer

                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (!trimmed) continue;

                                try {
                                    const json = JSON.parse(trimmed);
                                    if (json.message?.content) {
                                        controller.enqueue(json.message.content);
                                    }
                                    if (json.done) {
                                        controller.close();
                                        return;
                                    }
                                } catch {
                                    // Skip malformed JSON lines
                                }
                            }
                        }

                        controller.close();
                    } catch (err) {
                        const message =
                            err instanceof Error ? err.message : "Unknown Ollama error";
                        controller.enqueue(`\n\n⚠️ Ollama Error: ${message}`);
                        controller.close();
                    }
                },
            });
        } catch (err) {
            return new ReadableStream({
                start(controller) {
                    const error = err as { message?: string };
                    let message = "Failed to connect to Ollama.";

                    if (error.message?.includes("ECONNREFUSED")) {
                        message =
                            "Ollama is not running. Start it with: ollama serve";
                    } else if (error.message?.includes("model")) {
                        message = `Ollama model not found. Pull it with: ollama pull ${options?.model || "llama3.2"}`;
                    }

                    controller.enqueue(`⚠️ ${message}`);
                    controller.close();
                },
            });
        }
    }
}
