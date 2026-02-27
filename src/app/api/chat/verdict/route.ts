/**
 * ════════════════════════════════════════════════════════════════
 * Verdict API Route — /api/chat/verdict
 * ════════════════════════════════════════════════════════════════
 *
 * Accepts completed responses from all providers and the original
 * prompt, then streams a synthesized "Final Verdict" analysis.
 *
 * Uses the user's designated primary provider to generate the verdict.
 */

import { NextRequest, NextResponse } from "next/server";
import { ProviderManager } from "@/core/providers/manager";
import { ProviderName, StreamMessage } from "@/core/providers/types";

const VERDICT_SYSTEM_PROMPT = `You are a neutral, expert AI judge. You have been given the same prompt answered by multiple AI models simultaneously.

Your task is to produce a concise **Final Verdict** that:

1. **Best Answer** — Identify which model gave the strongest response and explain why in 1-2 sentences.
2. **Key Differences** — Highlight the most important differences between the responses (accuracy, depth, tone, creativity).
3. **Errors & Gaps** — Note any factual errors, hallucinations, or significant omissions in any response.
4. **Recommendation** — Give a single-sentence recommendation for the user.

Format your response in clean markdown with ## headers for each section.
Be concise — the user wants a quick, actionable summary, not a lengthy essay.
Do NOT reproduce the original responses. Only analyze and compare them.`;

const VALID_SUMMARIZERS: ProviderName[] = ["openai", "gemini", "claude", "grok"];

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            prompt,
            responses,
            apiKey,
            summarizer = "gemini",
        }: {
            prompt: string;
            responses: { provider: string; content: string }[];
            apiKey: string;
            summarizer?: string;
        } = body;

        // ── 1. Validate ──────────────────────────────────────
        if (!prompt || !responses?.length) {
            return NextResponse.json(
                { error: "Missing prompt or responses" },
                { status: 400 }
            );
        }

        const summarizerProvider = VALID_SUMMARIZERS.includes(summarizer as ProviderName)
            ? (summarizer as ProviderName)
            : "gemini";

        if (!apiKey) {
            return NextResponse.json(
                { error: `No API key for ${summarizerProvider}. Add it in Settings.` },
                { status: 400 }
            );
        }

        // ── 2. Build the comparison message ──────────────────
        const comparisonBlock = responses
            .map(
                (r) =>
                    `### ${r.provider.toUpperCase()}'s Response:\n${r.content}`
            )
            .join("\n\n---\n\n");

        const messages: StreamMessage[] = [
            { role: "system", content: VERDICT_SYSTEM_PROMPT },
            {
                role: "user",
                content: `Here is the original prompt:\n\n"${prompt}"\n\nHere are the responses from different AI models:\n\n${comparisonBlock}\n\nPlease provide your Final Verdict.`,
            },
        ];

        // ── 3. Stream the verdict ────────────────────────────
        const manager = new ProviderManager();
        manager.registerProvider(summarizerProvider, apiKey);

        const stream = await manager.streamFromProvider(
            summarizerProvider,
            messages,
            { temperature: 0.3 } // Lower temp for analytical output
        );

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (err) {
        console.error("[/api/chat/verdict] Error:", err);
        return NextResponse.json(
            { error: "Failed to generate verdict. Please try again." },
            { status: 500 }
        );
    }
}
