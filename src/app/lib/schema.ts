/**
 * ════════════════════════════════════════════════════════════════
 * Centralized Zod Schemas — AI Assistant Type System
 * ════════════════════════════════════════════════════════════════
 *
 * Single source of truth for all AI assistant data contracts.
 * Used by:
 *   - Server Actions (request validation)
 *   - ToolLoopAgent (structured LLM outputs)
 *   - Client stores (type inference)
 *
 * NOTE: Uses Zod v4 API (z.object takes shape as first arg).
 */

import { z } from "zod";

// ── Command Types ────────────────────────────────────────────
export const CommandType = z.enum([
    "CLICK",
    "PASTE",
    "COPY",
    "NAVIGATE",
    "SELECT",
    "SCROLL_TO",
]);
export type CommandType = z.infer<typeof CommandType>;

// ── Automation Command ───────────────────────────────────────
export const AutomationCommandSchema = z.object({
    id: z.string().uuid(),
    commandType: CommandType,
    targetElementId: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.number(),
});
export type AutomationCommand = z.infer<typeof AutomationCommandSchema>;

// ── AI Message ───────────────────────────────────────────────
export const AIMessageSchema = z.object({
    id: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    timestamp: z.number(),
    toolCalls: z
        .array(
            z.object({
                toolName: z.string(),
                args: z.record(z.string(), z.unknown()),
                result: z.unknown().optional(),
            })
        )
        .optional(),
    feedback: z.enum(["positive", "negative"]).optional(),
});
export type AIMessage = z.infer<typeof AIMessageSchema>;

// ── Serialized DOM Node ──────────────────────────────────────
// Manually typed — Zod v4 recursive types with z.lazy have
// strict covariance requirements, so we define the type
// explicitly and validate at runtime.
export type SerializedNode = {
    tag: string;
    role?: string;
    text?: string;
    id?: string;
    attributes?: Record<string, string>;
    children?: SerializedNode[];
};

// ── Context Payload ──────────────────────────────────────────
export const ContextPayloadSchema = z.object({
    route: z.string(),
    activeProviders: z.array(z.string()),
    activeResponseSetId: z.string().nullable(),
    domSnapshot: z.unknown().optional(),
    timestamp: z.number(),
});
export type ContextPayload = z.infer<typeof ContextPayloadSchema> & {
    domSnapshot?: SerializedNode;
};

// ── Server Action Request ────────────────────────────────────
export const AssistantRequestSchema = z.object({
    prompt: z.string().min(1),
    context: ContextPayloadSchema,
    sessionId: z.string(),
    conversationHistory: z.array(AIMessageSchema).optional(),
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

// ── Server Action Response ───────────────────────────────────
export const AssistantResponseSchema = z.object({
    message: AIMessageSchema,
    commands: z.array(AutomationCommandSchema).optional(),
    error: z.string().optional(),
});
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

// ── Telemetry Span Payload ───────────────────────────────────
export const TelemetrySpanSchema = z.object({
    sessionId: z.string(),
    spanName: z.string(),
    traceId: z.string(),
    startTime: z.number(),
    endTime: z.number(),
    attributes: z.record(z.string(), z.unknown()),
});
export type TelemetrySpan = z.infer<typeof TelemetrySpanSchema>;
