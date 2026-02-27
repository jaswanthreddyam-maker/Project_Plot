/**
 * ════════════════════════════════════════════════════════════════
 * Server Action — Production ToolLoopAgent
 * ════════════════════════════════════════════════════════════════
 *
 * Primary entry point for the AI assistant. This Server Action:
 *   1. Validates the incoming request payload
 *   2. Injects the sanitized ContextPayload (DOM JSON) into
 *      the agent's system message so it "sees" the current UI
 *   3. Runs the agentic tool loop via generateText + tools
 *      with maxSteps: 20 to prevent infinite loops
 *   4. Extracts dispatched AutomationCommand objects from
 *      tool results for the assistantStore commandQueue
 *   5. Returns a serializable response compatible with
 *      Next.js Server Actions
 *
 * Model:  google("gemini-1.5-pro") via @ai-sdk/google
 * Tools:  dispatchUICommand, vectorSearch, getApplicationState
 */
"use server";

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { assistantTools } from "@/app/lib/tools";
import {
    AssistantRequestSchema,
    AssistantResponseSchema,
    AutomationCommand,
    type AssistantRequest,
    type AssistantResponse,
    type AIMessage,
} from "@/app/lib/schema";

// ── System Instruction ───────────────────────────────────────
const SYSTEM_PROMPT = `You are Plot Assistant. When a user asks to perform an action (like asking providers or copying text), you MUST use the dispatchUICommand tool. Do not just explain how to do it; actually generate the command to automate it. Access is denied to any element tagged with data-ai-ignore.

COMMAND PATTERN:
- When a user says "ask the providers [something]", dispatch:
  1. dispatchUICommand({ commandType: "PASTE", targetElementId: "prompt-input", payload: { value: "<the prompt>" } })
  2. dispatchUICommand({ commandType: "CLICK", targetElementId: "send-button" })
- When a user says "copy [something]", dispatch:
  dispatchUICommand({ commandType: "COPY", targetElementId: "<element-id>", payload: { sourceField: "text" } })
- When a user says "go to [page]", dispatch:
  dispatchUICommand({ commandType: "NAVIGATE", targetElementId: "root", payload: { url: "<path>" } })

Available commandTypes: CLICK, PASTE, COPY, NAVIGATE, SELECT, SCROLL_TO
Key targetElementIds: "prompt-input", "send-button"

RESPONSE STYLE:
Respond in clean, modern prose. Do not use markdown headers, bullet points, or bold text (no #, *, or - symbols). Use line breaks for separation. Keep it aesthetic and easy to read.

RULES:
- Be concise, conversational, and direct. No robotic greetings.
- After dispatching commands, give a short 1-line confirmation only.
- NEVER access or interact with elements marked data-ai-ignore (passwords, API keys, vault).
- Use vectorSearch when the user asks about documentation or features.
- Use getApplicationState when you need to inspect current UI context.`;

/**
 * Main AI assistant Server Action.
 */
export async function runAssistant(
    rawRequest: AssistantRequest
): Promise<AssistantResponse> {
    try {
        // ── 1. Validate request ──────────────────────────────
        const parseResult = AssistantRequestSchema.safeParse(rawRequest);
        if (!parseResult.success) {
            return {
                message: {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: "Invalid request. Please try again.",
                    timestamp: Date.now(),
                },
                error: parseResult.error.message,
            };
        }

        const request = parseResult.data;

        // ── 1. Intent Router ──
        const lower = request.prompt.toLowerCase().trim();
        const isCasualGreeting = /^(hi|hello|hey|howdy|sup|yo|thanks|thank you|ok|okay|cool|bye|gm|gn|lol|haha)\b/.test(lower);
        const isKnowledgeBaseIntent = /\b(plot|feature|doc|documentation|how to|what is|explain|search|find|help)\b/.test(lower);
        const isUIActionIntent = /\b(workspace|provider|referee|vault|mentor|navigate|click|go to|send|ask the|copy)\b/.test(lower);

        // Static Greeting Bypass: Don't call the LLM at all
        if (isCasualGreeting && !isKnowledgeBaseIntent && !isUIActionIntent) {
            return {
                message: {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: "Hey! I'm the Plot Assistant. How can I help you today?",
                    timestamp: Date.now(),
                }
            };
        }

        // ── 2. Lazy Context Loading & Snapshot Pruning ──
        // Only include the DOM snapshot and prune it heavily if asking about UI actions
        let prunedSnapshotStr = "";
        if (isUIActionIntent && request.context.domSnapshot) {
            // Helper to recursively prune DOM tree to just interactive nodes
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pruneNode = (node: any): any => {
                if (!node) return null;
                const isInteractive = !!node.id || !!node.role || (node.attributes && node.attributes.href);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const children = (node.children || []).map(pruneNode).filter(Boolean) as any[];
                
                if (isInteractive || children.length > 0) {
                    return {
                        tag: node.tag,
                        ...(node.id && { id: node.id }),
                        ...(node.role && { role: node.role }),
                        ...(node.text && node.text.trim() && { text: node.text.substring(0, 50) }),
                        ...(children.length > 0 && { children }),
                    };
                }
                return null;
            };

            const pruned = pruneNode(request.context.domSnapshot);
            if (pruned) {
                prunedSnapshotStr = `\nDOM Snapshot (minified interactive elements):\n${JSON.stringify(pruned)}`;
            }
        }

        // ── 3. Build context-enriched system message ─────────
        const contextBlock = [
            `Route: ${request.context.route}`,
            `Active providers: ${request.context.activeProviders.join(", ")}`,
            request.context.activeResponseSetId
                ? `Active response set: ${request.context.activeResponseSetId}`
                : null,
            prunedSnapshotStr || null,
        ]
            .filter(Boolean)
            .join("\n");

        const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
            {
                role: "system" as const,
                content: `${SYSTEM_PROMPT}\n\n--- Current Application Context ---\n${contextBlock}`,
            },
        ];

        // Inject conversation history (last 10 turns)
        if (request.conversationHistory) {
            for (const msg of request.conversationHistory.slice(-10)) {
                if (msg.role === "user" || msg.role === "assistant") {
                    messages.push({ role: msg.role, content: msg.content });
                }
            }
        }

        // Current user prompt
        messages.push({ role: "user" as const, content: request.prompt });

        // ── 4. Run ToolLoopAgent ─────────────────────────────
        let responseText: string;
        const collectedCommands: AutomationCommand[] = [];

        const hasApiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

        if (!hasApiKey) {
            console.warn(
                "[ai.ts] GOOGLE_GENERATIVE_AI_API_KEY not set. Falling back to stub mode."
            );
            const stub = getStubResponse(request.prompt, request.context);
            responseText = stub.text;
            collectedCommands.push(...stub.commands);
        } else {
            // Bypass tools entirely if completely unrecognized
            const skipTools = !isKnowledgeBaseIntent && !isUIActionIntent;
            const toolsToUse = skipTools ? undefined : assistantTools;

            // ToolLoopAgent execution with Hardcoded MAX_STEPS = 2
            const MAX_STEPS = skipTools ? 1 : 2;

            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await (generateText as any)({
                    model: google("gemini-2.0-flash"),
                    messages,
                    tools: toolsToUse,
                    maxSteps: MAX_STEPS,
                });

                responseText = result.text || "Done.";

                // Walk all agent steps and extract dispatched commands
                for (const step of result.steps || []) {
                    for (const call of step.toolCalls || []) {
                        if (call.toolName === "dispatchUICommand") {
                            // The tool's execute() returns { success, command }
                            const toolResult = (step.toolResults || []).find(
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (r: any) => r.toolCallId === call.toolCallId
                            );

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const output = (toolResult as any)?.result ?? (toolResult as any)?.output;
                            if (
                                output &&
                                typeof output === "object" &&
                                "command" in output &&
                                output.success
                            ) {
                                collectedCommands.push(output.command as AutomationCommand);
                            }
                        }
                    }
                }
            } catch (aiError: unknown) {
                console.error("[ai.ts] ToolLoopAgent error:", aiError);

                // Check for rate limit errors
                const errorMessage = aiError instanceof Error ? aiError.message : String(aiError);
                const isRateLimit =
                    errorMessage.includes("RESOURCE_EXHAUSTED") ||
                    errorMessage.includes("429") ||
                    errorMessage.includes("quota");

                if (isRateLimit) {
                    responseText =
                        "__RATE_LIMITED__Rate limit hit. Please wait before sending another message.";
                } else {
                    responseText =
                        "Something went wrong while processing your request. Please try again.";
                }
            }
        }

        // ── 4. Build serializable response ───────────────────
        const assistantMessage: AIMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: responseText,
            timestamp: Date.now(),
            toolCalls:
                collectedCommands.length > 0
                    ? collectedCommands.map((cmd) => ({
                        toolName: "dispatchUICommand",
                        args: {
                            commandType: cmd.commandType,
                            targetElementId: cmd.targetElementId,
                        },
                        result: { success: true },
                    }))
                    : undefined,
        };

        const response: AssistantResponse = {
            message: assistantMessage,
            commands: collectedCommands.length > 0 ? collectedCommands : undefined,
        };

        // Validate before returning
        const outParse = AssistantResponseSchema.safeParse(response);
        if (!outParse.success) {
            console.error("[ai.ts] Response validation failed:", outParse.error);
        }

        return response;
    } catch (error) {
        console.error("[ai.ts] Unhandled Server Action error:", error);
        return {
            message: {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "An unexpected error occurred. Please try again.",
                timestamp: Date.now(),
            },
            error: "Internal server error",
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// Stub fallback (used when GOOGLE_GENERATIVE_AI_API_KEY is not set)
// ═══════════════════════════════════════════════════════════════

interface StubResult {
    text: string;
    commands: AutomationCommand[];
}

function makeCommand(
    commandType: string,
    targetElementId: string,
    payload?: Record<string, unknown>
): AutomationCommand {
    return {
        id: crypto.randomUUID(),
        commandType: commandType as AutomationCommand["commandType"],
        targetElementId,
        payload,
        timestamp: Date.now(),
    };
}

function getStubResponse(
    prompt: string,
    context: { route: string; activeProviders: string[] }
): StubResult {
    const lower = prompt.toLowerCase().trim();

    // "Ask the providers" → PASTE + CLICK
    const askMatch = lower.match(
        /^(?:ask|send|prompt|tell)(?:\s+(?:the|all|my))?\s+(?:providers?|models?|llms?)\s+(.+)/i
    );
    if (askMatch) {
        const userPrompt = askMatch[1].trim();
        return {
            text: `Done — sent "${userPrompt}" to your providers.`,
            commands: [
                makeCommand("PASTE", "prompt-input", { value: userPrompt }),
                makeCommand("CLICK", "send-button"),
            ],
        };
    }

    // Direct send
    if (/^(send|submit|go)\b/.test(lower) && lower.length < 20) {
        return { text: "Sent.", commands: [makeCommand("CLICK", "send-button")] };
    }

    // Greeting
    if (/^(hi|hello|hey|howdy|sup|yo)\b/.test(lower)) {
        return {
            text: `What's up? ${context.activeProviders.join(", ")} active. What do you need?`,
            commands: [],
        };
    }

    // Providers
    if (lower.includes("provider") || lower.includes("model") || lower.includes("llm")) {
        return {
            text: `Active: ${context.activeProviders.join(", ")}. Toggle at the top.`,
            commands: [],
        };
    }

    // Default
    return {
        text: `No API key — running in stub mode. Add GOOGLE_GENERATIVE_AI_API_KEY to .env, then restart.\n\nTry: "ask the providers what is quantum computing"`,
        commands: [],
    };
}
