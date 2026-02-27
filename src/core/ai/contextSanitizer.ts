/**
 * ════════════════════════════════════════════════════════════════
 * Context Sanitization Pipeline
 * ════════════════════════════════════════════════════════════════
 *
 * Orchestrates the multi-tier context gathering and sanitization
 * process for the AI assistant. Produces a ContextPayload that
 * is safe to transmit to the server.
 *
 * Pipeline phases:
 *   1. Component Tagging  — data-ai-ignore attributes on sensitive nodes
 *   2. Tree Traversal     — Recursive DOM parsing via domSerializer
 *   3. Branch Pruning     — Blacklisted branches omitted entirely
 *   4. JSON Serialization — Raw HTML → semantic JSON graph
 *   5. Context Enrichment — Route, providers, active state injected
 *   6. Token Budgeting    — Deep branches truncated to stay within limits
 */

import { serializeDOM } from "./domSerializer";
import type { ContextPayload } from "@/app/lib/schema";

// ── Configuration ────────────────────────────────────────────
const MAX_CONTEXT_DEPTH = 8;

/**
 * Estimates the rough token count of a serialized JSON object.
 * Uses a conservative ~4 chars per token ratio.
 */
function estimateTokens(obj: unknown): number {
    const json = JSON.stringify(obj);
    return Math.ceil(json.length / 4);
}

/**
 * Truncates deeply nested branches to stay within a token budget.
 * Recursively removes children beyond the depth limit.
 */
function truncateDepth(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node: any,
    currentDepth: number = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    if (!node || typeof node !== "object") return node;

    if (currentDepth >= MAX_CONTEXT_DEPTH) {
        // Replace deep branches with a summary
        if (node.children && node.children.length > 0) {
            return {
                ...node,
                children: undefined,
                text: `[${node.children.length} nested elements truncated]`,
            };
        }
        return node;
    }

    if (node.children && Array.isArray(node.children)) {
        return {
            ...node,
            children: node.children.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (child: any) => truncateDepth(child, currentDepth + 1)
            ),
        };
    }

    return node;
}

/**
 * Gathers the current application context from the browser state.
 * Returns route, active providers, and visible UI elements.
 */
function gatherApplicationState(): Omit<ContextPayload, "domSnapshot" | "timestamp"> {
    const route =
        typeof window !== "undefined" ? window.location.pathname : "/workspace";

    // Read provider state from Zustand without importing the store
    // to maintain decoupling. We read from the DOM or default.
    let activeProviders: string[] = ["openai", "gemini", "claude", "grok", "ollama"];
    let activeResponseSetId: string | null = null;

    // Try to read provider toggles from the DOM
    if (typeof document !== "undefined") {
        const providerButtons = document.querySelectorAll(
            '[data-provider-toggle][aria-pressed="true"]'
        );
        if (providerButtons.length > 0) {
            activeProviders = Array.from(providerButtons).map(
                (btn) => btn.getAttribute("data-provider-toggle") || ""
            ).filter(Boolean);
        }

        const activeSet = document.querySelector("[data-active-response-set]");
        if (activeSet) {
            activeResponseSetId = activeSet.getAttribute("data-active-response-set");
        }
    }

    return { route, activeProviders, activeResponseSetId };
}

/**
 * Main entry point: Gathers, sanitizes, and packages the
 * application context into a ContextPayload ready for the
 * AI assistant Server Action.
 *
 * @param includeDOM - Whether to include the DOM snapshot
 * @returns A sanitized ContextPayload
 */
export function gatherContext(includeDOM: boolean = true): ContextPayload {
    const appState = gatherApplicationState();

    let domSnapshot = undefined;
    if (includeDOM) {
        const rawSnapshot = serializeDOM();
        if (rawSnapshot) {
            // Truncate deep branches
            domSnapshot = truncateDepth(rawSnapshot, 0);

            // Check token budget (~4000 tokens max for context)
            const tokens = estimateTokens(domSnapshot);
            if (tokens > 4000) {
                // If too large, strip the DOM entirely and send just metadata
                console.warn(
                    `[contextSanitizer] DOM snapshot too large (${tokens} tokens), stripping`
                );
                domSnapshot = undefined;
            }
        }
    }

    return {
        ...appState,
        domSnapshot,
        timestamp: Date.now(),
    };
}
