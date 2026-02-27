"use client";

import { useEffect, useState } from "react";
import { AssistantOverlay } from "@/components/ai/AssistantOverlay";
import { usePlotContextGathering } from "@/hooks/usePlotContextGathering";
import { initTelemetry, stopTelemetry } from "@/core/ai/telemetry";

export function AIAssistantBoundary() {
    const [mounted, setMounted] = useState(false);
    const { getContext } = usePlotContextGathering();

    useEffect(() => {
        setMounted(true);
        initTelemetry();
        return () => stopTelemetry();
    }, []);

    if (!mounted) return null;

    return (
        <>
            <AssistantOverlay getContext={getContext} />
        </>
    );
}
