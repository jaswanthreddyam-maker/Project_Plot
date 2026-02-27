/**
 * Code Mentor API Route — /api/chat/mentor
 *
 * Accepts code + language, sends to the selected LLM provider
 * with a system prompt that enforces JSON-structured output,
 * then validates the response against mentorOutputSchema.
 */

import { NextRequest, NextResponse } from "next/server";
import { ProviderManager } from "@/core/providers/manager";
import { ProviderName, StreamMessage } from "@/core/providers/types";
import { mentorOutputSchema } from "@/app/lib/mentor-schema";

const MENTOR_SYSTEM_PROMPT = `You are Code Mentor, a senior developer and educator analyzing source code.

You MUST respond with ONLY a valid JSON object matching this exact structure (no markdown, no extra text):

{
  "code": "<the source code you are analyzing, cleaned up if needed>",
  "explanationSteps": [
    {
      "heading": "<short title for this step>",
      "description": "<2-4 sentence explanation of this step>"
    }
  ],
  "diagramSyntax": "<valid Mermaid.js flowchart starting with 'graph TD'>",
  "expectedOutput": "<the expected console output or return value when this code runs>"
}

STRICT RULES:
- Do NOT include any markdown symbols like #, *, or - in the JSON strings. The UI will handle all styling.
- explanationSteps must have 3-5 steps, each with a heading and description in clean prose.
- Each description should be 2-4 sentences, pedagogical and clear.
- diagramSyntax must be valid Mermaid syntax. Use graph TD for flowcharts.
- Quote all Mermaid node labels that contain special characters like parentheses.
- expectedOutput should show realistic sample output as plain text.
- Return ONLY the JSON object. No surrounding text, no code fences.`;

interface MentorRequestBody {
    code: string;
    language?: string;
    apiKey?: string;
    provider?: string;
}

async function streamToText(stream: ReadableStream<string>): Promise<string> {
    const reader = stream.getReader();
    let combined = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        combined += value;
    }
    return combined.trim();
}

function extractJSON(raw: string): string {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    return cleaned.trim();
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as MentorRequestBody;
        const code = typeof body.code === "string" ? body.code.trim() : "";
        const language = typeof body.language === "string" ? body.language.trim() : "typescript";
        const provider = (typeof body.provider === "string" ? body.provider.trim() : "gemini") as ProviderName;
        const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

        if (!code) {
            return NextResponse.json({ error: "Code is required." }, { status: 400 });
        }
        if (!apiKey) {
            return NextResponse.json({ error: "API key is required." }, { status: 400 });
        }

        const messages: StreamMessage[] = [
            { role: "system", content: MENTOR_SYSTEM_PROMPT },
            {
                role: "user",
                content: `Analyze this ${language} code:\n\n${code}`,
            },
        ];

        const manager = new ProviderManager();
        manager.registerProvider(provider, apiKey);

        const stream = await manager.streamFromProvider(provider, messages, {
            temperature: 0.3,
            maxTokens: 2500,
        });

        const rawText = await streamToText(stream);
        if (!rawText) {
            return NextResponse.json(
                { error: "Mentor returned an empty response." },
                { status: 502 }
            );
        }

        const jsonText = extractJSON(rawText);

        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch {
            return NextResponse.json({
                code,
                explanationSteps: [{ heading: "Analysis", description: rawText }],
                diagramSyntax: "graph TD\\n    A[Code Input] --> B[Analysis Complete]",
                expectedOutput: "",
            });
        }

        const validated = mentorOutputSchema.safeParse(parsed);
        if (!validated.success) {
            return NextResponse.json({
                code: parsed.code || code,
                explanationSteps: Array.isArray(parsed.explanationSteps)
                    ? parsed.explanationSteps
                    : [{ heading: "Analysis", description: JSON.stringify(parsed) }],
                diagramSyntax: parsed.diagramSyntax || "graph TD\\n    A[Code] --> B[Analyzed]",
                expectedOutput: parsed.expectedOutput || "",
            });
        }

        return NextResponse.json(validated.data);
    } catch (err) {
        console.error("[/api/chat/mentor] Error:", err);
        return NextResponse.json(
            { error: "Failed to analyze code." },
            { status: 500 }
        );
    }
}
