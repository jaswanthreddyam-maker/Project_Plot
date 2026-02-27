/**
 * ════════════════════════════════════════════════════════════════
 * Client-Side Telemetry Utilities
 * ════════════════════════════════════════════════════════════════
 *
 * Lightweight wrappers around OpenTelemetry API for capturing
 * AI assistant interaction traces on the client side.
 *
 * Traces are batched and exported to /api/telemetry/route.ts
 * for enrichment and forwarding to the observability platform.
 */

import type { TelemetrySpan } from "@/app/lib/schema";

// ── Span Buffer ──────────────────────────────────────────────
// Buffers spans and batch-sends them to the server periodically.
const spanBuffer: TelemetrySpan[] = [];
const FLUSH_INTERVAL_MS = 10_000; // 10 seconds
const MAX_BUFFER_SIZE = 50;

let flushTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background flush timer.
 * Automatically sends buffered spans to the telemetry endpoint.
 */
export function initTelemetry(): void {
    if (flushTimer) return;
    flushTimer = setInterval(flushSpans, FLUSH_INTERVAL_MS);

    // Flush on page unload
    if (typeof window !== "undefined") {
        window.addEventListener("beforeunload", flushSpans);
    }
}

/**
 * Stop the background flush timer.
 */
export function stopTelemetry(): void {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
    flushSpans();
}

/**
 * Flush all buffered spans to the telemetry endpoint.
 */
async function flushSpans(): Promise<void> {
    if (spanBuffer.length === 0) return;

    const spans = spanBuffer.splice(0, spanBuffer.length);

    try {
        await fetch("/api/telemetry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spans }),
        });
    } catch (error) {
        console.warn("[telemetry] Failed to flush spans:", error);
        // Re-add failed spans back to buffer (with limit)
        if (spanBuffer.length + spans.length <= MAX_BUFFER_SIZE * 2) {
            spanBuffer.push(...spans);
        }
    }
}

/**
 * Record a telemetry span.
 */
function recordSpan(
    sessionId: string,
    spanName: string,
    attributes: Record<string, unknown>
): void {
    const span: TelemetrySpan = {
        sessionId,
        spanName,
        traceId: crypto.randomUUID(),
        startTime: Date.now(),
        endTime: Date.now(),
        attributes,
    };

    spanBuffer.push(span);

    // Auto-flush if buffer is full
    if (spanBuffer.length >= MAX_BUFFER_SIZE) {
        flushSpans();
    }
}

// ── Public Logging Functions ─────────────────────────────────

/**
 * Log the sanitized context sent to the AI model.
 */
export function logPrompt(
    sessionId: string,
    prompt: string,
    contextTokenEstimate: number
): void {
    recordSpan(sessionId, "ai.prompt", {
        prompt,
        contextTokenEstimate,
    });
}

/**
 * Log the AI model's response.
 */
export function logResponse(
    sessionId: string,
    response: string,
    latencyMs: number,
    tokenUsage?: { prompt: number; completion: number }
): void {
    recordSpan(sessionId, "ai.response", {
        responseLength: response.length,
        latencyMs,
        tokenUsage,
    });
}

/**
 * Log a UI command execution result.
 */
export function logCommandExecution(
    sessionId: string,
    commandType: string,
    targetElementId: string,
    success: boolean,
    errorMessage?: string
): void {
    recordSpan(sessionId, "ai.command", {
        commandType,
        targetElementId,
        success,
        errorMessage,
    });
}

/**
 * Log explicit user feedback (thumbs up/down).
 */
export function logFeedback(
    sessionId: string,
    messageId: string,
    feedbackType: "positive" | "negative"
): void {
    recordSpan(sessionId, "ai.feedback.explicit", {
        messageId,
        feedbackType,
    });
}

/**
 * Log implicit negative feedback (user corrects AI action).
 */
export function logImplicitFeedback(
    sessionId: string,
    commandType: string,
    targetElementId: string,
    correctionType: "deleted" | "modified" | "undone"
): void {
    recordSpan(sessionId, "ai.feedback.implicit", {
        commandType,
        targetElementId,
        correctionType,
        reward: -1,
    });
}
