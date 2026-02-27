/**
 * Google Gemini streaming adapter.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMAdapter, StreamMessage, StreamOptions } from "./types";

const FALLBACK_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
];

function toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === "string" && error.trim()) {
        return error;
    }

    try {
        return JSON.stringify(error);
    } catch {
        return "Unknown Gemini error.";
    }
}

function isModelUnavailable(message: string): boolean {
    const normalized = message.toLowerCase();
    return (
        normalized.includes("models/") ||
        normalized.includes("model not found") ||
        normalized.includes("model is not found") ||
        normalized.includes("requested entity was not found") ||
        normalized.includes("unavailable") ||
        (normalized.includes("model") && normalized.includes("404"))
    );
}

function buildModelCandidates(requestedModel?: string): string[] {
    const seen = new Set<string>();
    const candidates: string[] = [];

    const add = (value: string | undefined) => {
        if (!value) return;
        const model = value.trim();
        if (!model || seen.has(model)) return;
        seen.add(model);
        candidates.push(model);
    };

    add(requestedModel);
    add(process.env.GEMINI_MODEL);
    for (const model of FALLBACK_MODELS) add(model);

    return candidates;
}

export class GeminiAdapter implements LLMAdapter {
    private genAI: GoogleGenerativeAI;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    private mapConnectionError(message: string): string {
        if (
            message.includes("API_KEY_INVALID") ||
            message.includes("API key not valid") ||
            message.includes("Permission denied")
        ) {
            return "Invalid Gemini API key.";
        }
        if (
            message.includes("RESOURCE_EXHAUSTED") ||
            message.toLowerCase().includes("quota")
        ) {
            return "Gemini quota exceeded. Please try again later.";
        }
        if (isModelUnavailable(message)) {
            return "Requested Gemini model is unavailable.";
        }
        return `Gemini Error: ${message}`;
    }

    private toErrorStream(message: string): ReadableStream<string> {
        return new ReadableStream<string>({
            start(controller) {
                controller.enqueue(`Warning: ${message}`);
                controller.close();
            },
        });
    }

    private async startGeminiStream(
        modelName: string,
        messages: StreamMessage[],
        options?: StreamOptions
    ) {
        const systemMessage = messages.find((m) => m.role === "system");

        const model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens ?? 4096,
            },
            ...(systemMessage
                ? { systemInstruction: systemMessage.content }
                : {}),
        });

        const chatMessages = messages
            .filter((m) => m.role !== "system")
            .map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
            }));

        const lastMessage = chatMessages.pop();
        if (!lastMessage) {
            throw new Error("No user message provided.");
        }

        const chat = model.startChat({
            history:
                chatMessages.length > 0
                    ? (chatMessages as Array<{
                        role: "user" | "model";
                        parts: Array<{ text: string }>;
                    }>)
                    : undefined,
        });

        return chat.sendMessageStream(
            lastMessage.parts.map((p) => p.text).join("\n")
        );
    }

    async stream(
        messages: StreamMessage[],
        options?: StreamOptions
    ): Promise<ReadableStream<string>> {
        const candidates = buildModelCandidates(options?.model);
        let lastModelError = "";

        for (const modelName of candidates) {
            try {
                const result = await this.startGeminiStream(modelName, messages, options);

                return new ReadableStream<string>({
                    async start(controller) {
                        try {
                            for await (const chunk of result.stream) {
                                const text = chunk.text();
                                if (text) {
                                    controller.enqueue(text);
                                }
                            }
                        } catch (streamError) {
                            const message = toErrorMessage(streamError);
                            controller.enqueue(`\n\nGemini Error: ${message}`);
                        } finally {
                            controller.close();
                        }
                    },
                });
            } catch (error) {
                const message = toErrorMessage(error);
                lastModelError = message;

                if (isModelUnavailable(message)) {
                    continue;
                }

                return this.toErrorStream(this.mapConnectionError(message));
            }
        }

        const modelList = candidates.join(", ");
        const detail = lastModelError ? ` Last error: ${lastModelError}` : "";
        return this.toErrorStream(
            `Requested Gemini model is unavailable. Tried: ${modelList}.${detail}`
        );
    }
}
