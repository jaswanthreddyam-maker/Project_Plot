/**
 * ════════════════════════════════════════════════════════════════
 * AIAssistantMount — Root-Level AI Assistant Entry Point
 * ════════════════════════════════════════════════════════════════
 *
 * Mounted in layout.tsx OUTSIDE the main Providers tree.
 * This ensures complete lifecycle isolation — if the AI assistant
 * crashes, the main application continues operating normally.
 *
 * Responsibilities:
 *   - Conditionally renders the chat overlay (AssistantOverlay)
 *   - Initializes background context gathering
 *   - Starts the telemetry flush timer
 */
"use client";

import { useEffect } from "react";
import { AssistantOverlay } from "./AssistantOverlay";
import { usePlotContextGathering } from "@/hooks/usePlotContextGathering";
import { initTelemetry, stopTelemetry } from "@/core/ai/telemetry";

export function AIAssistantMount() {
    const { getContext } = usePlotContextGathering();

    // Initialize telemetry on mount
    useEffect(() => {
        initTelemetry();
        return () => stopTelemetry();
    }, []);

    return <AssistantOverlay getContext={getContext} />;
}
