/**
 * Image fan-out API - /api/generate-images
 *
 * Triggers multiple image providers concurrently and streams
 * provider progress/results back as NDJSON lines.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type ImageProvider = "openai" | "grok";

const SUPPORTED_IMAGE_PROVIDERS: ImageProvider[] = ["openai", "grok"];

interface GenerateImagesBody {
    prompt?: string;
    providers?: string[];
    apiKeys?: Record<string, string>;
    options?: {
        count?: number;
        size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
        quality?: "low" | "medium" | "high" | "auto";
        openaiModel?: string;
        grokModel?: string;
    };
}

interface ImageStreamEvent {
    type:
    | "provider-start"
    | "provider-error"
    | "image"
    | "provider-done"
    | "done";
    provider?: string;
    error?: string;
    image?: {
        id: string;
        dataUrl: string;
        revisedPrompt: string | null;
    };
}

function isImageProvider(value: string): value is ImageProvider {
    return SUPPORTED_IMAGE_PROVIDERS.includes(value as ImageProvider);
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return "Unknown image generation error.";
}

function clampCount(value: number | undefined): number {
    if (!value || Number.isNaN(value)) return 2;
    return Math.max(1, Math.min(4, Math.floor(value)));
}

function writeEvent(
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder,
    payload: ImageStreamEvent
) {
    controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
}

async function runOpenAICompatibleImageGeneration(
    provider: ImageProvider,
    prompt: string,
    apiKey: string,
    options: GenerateImagesBody["options"],
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder
) {
    writeEvent(controller, encoder, { type: "provider-start", provider });

    try {
        const client = new OpenAI({
            apiKey,
            ...(provider === "grok" ? { baseURL: "https://api.x.ai/v1" } : {}),
        });

        const count = clampCount(options?.count);
        const size = options?.size ?? "1024x1024";
        const quality = options?.quality ?? "auto";
        const model =
            provider === "grok"
                ? options?.grokModel || "grok-2-image-latest"
                : options?.openaiModel || "gpt-image-1";

        const response = await client.images.generate({
            prompt,
            model,
            n: count,
            size,
            quality,
            response_format: "b64_json",
        });

        const data = response.data ?? [];
        if (!data.length) {
            throw new Error("No images returned by provider.");
        }

        data.forEach((image, index) => {
            const dataUrl = image.b64_json
                ? `data:image/png;base64,${image.b64_json}`
                : image.url || "";

            if (!dataUrl) return;

            writeEvent(controller, encoder, {
                type: "image",
                provider,
                image: {
                    id: `${provider}-${index}`,
                    dataUrl,
                    revisedPrompt: image.revised_prompt ?? null,
                },
            });
        });

        writeEvent(controller, encoder, { type: "provider-done", provider });
    } catch (error) {
        writeEvent(controller, encoder, {
            type: "provider-error",
            provider,
            error: toErrorMessage(error),
        });
        writeEvent(controller, encoder, { type: "provider-done", provider });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as GenerateImagesBody;
        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        const apiKeys = body.apiKeys ?? {};
        const requestedProviders = Array.from(
            new Set((body.providers ?? SUPPORTED_IMAGE_PROVIDERS).map((p) => p.trim()))
        ).filter(Boolean);

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
        }

        const validProviders = requestedProviders.filter(isImageProvider);
        if (validProviders.length === 0) {
            return NextResponse.json(
                { error: "No supported image providers selected." },
                { status: 400 }
            );
        }

        const unsupportedProviders = requestedProviders.filter(
            (provider) => !isImageProvider(provider)
        );

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                for (const provider of unsupportedProviders) {
                    writeEvent(controller, encoder, {
                        type: "provider-error",
                        provider,
                        error: `${provider} does not support image fan-out in this build.`,
                    });
                    writeEvent(controller, encoder, { type: "provider-done", provider });
                }

                const runs = validProviders.map(async (provider) => {
                    const key = apiKeys[provider];
                    if (!key) {
                        writeEvent(controller, encoder, {
                            type: "provider-error",
                            provider,
                            error: `Missing API key for ${provider}.`,
                        });
                        writeEvent(controller, encoder, { type: "provider-done", provider });
                        return;
                    }

                    await runOpenAICompatibleImageGeneration(
                        provider,
                        prompt,
                        key,
                        body.options,
                        controller,
                        encoder
                    );
                });

                await Promise.allSettled(runs);
                writeEvent(controller, encoder, { type: "done" });
                controller.close();
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "application/x-ndjson; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error) {
        console.error("[/api/generate-images] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate images." },
            { status: 500 }
        );
    }
}

