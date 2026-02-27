/**
 * ════════════════════════════════════════════════════════════════
 * usePlotContextGathering Hook — Background Context Aggregation
 * ════════════════════════════════════════════════════════════════
 *
 * Runs invisibly at the workspace root level. Continuously
 * aggregates public, non-sensitive application state into a
 * lightweight ContextPayload for the AI assistant.
 *
 * Optimization:
 *   - Debounced (500ms) to prevent perf degradation during rapid changes
 *   - Stores payload in a ref (not state) to avoid re-renders
 *   - Only recomputes when route or provider state changes
 */

"use client";

import { useRef, useCallback, useEffect } from "react";
import { gatherContext } from "@/core/ai/contextSanitizer";
import type { ContextPayload } from "@/app/lib/schema";

/**
 * Background hook that pre-compiles the application context.
 * Does NOT cause re-renders — stores the payload in a ref.
 *
 * @returns getContext() — synchronous function to retrieve the latest payload
 *
 * @example
 * ```tsx
 * function WorkspaceRoot() {
 *   const { getContext } = usePlotContextGathering();
 *   // Pass getContext to the chat input component
 * }
 * ```
 */
export function usePlotContextGathering() {
    const contextRef = useRef<ContextPayload | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounced context refresh
    const refreshContext = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            try {
                contextRef.current = gatherContext(true);
            } catch (error) {
                console.warn("[usePlotContextGathering] Context gathering failed:", error);
                // Fallback: gather without DOM snapshot
                contextRef.current = gatherContext(false);
            }
        }, 500);
    }, []);

    // Synchronous accessor for the latest context
    const getContext = useCallback((): ContextPayload => {
        // If we have a cached context, return it
        if (contextRef.current) return contextRef.current;

        // Otherwise, gather fresh (synchronously, no DOM for perf)
        return gatherContext(false);
    }, []);

    // ── Observers ────────────────────────────────────────
    // Listen for route changes and DOM mutations

    useEffect(() => {
        // Initial context gathering
        refreshContext();

        // Listen for route changes (popstate)
        const handleRouteChange = () => refreshContext();
        window.addEventListener("popstate", handleRouteChange);

        // MutationObserver for significant DOM changes
        const observer = new MutationObserver((mutations) => {
            // Only refresh if meaningful changes occurred
            const hasMeaningfulChange = mutations.some(
                (m) =>
                    m.type === "childList" &&
                    m.addedNodes.length + m.removedNodes.length > 0
            );
            if (hasMeaningfulChange) {
                refreshContext();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            // Don't observe attributes/characterData to reduce noise
        });

        return () => {
            window.removeEventListener("popstate", handleRouteChange);
            observer.disconnect();
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [refreshContext]);

    return { getContext, refreshContext };
}
