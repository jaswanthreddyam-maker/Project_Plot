/**
 * ════════════════════════════════════════════════════════════════
 * FeedbackButtons — Thumbs Up/Down for AI Messages
 * ════════════════════════════════════════════════════════════════
 */
"use client";

import { useCallback } from "react";
import { useAssistantStore } from "@/store/assistantStore";
import { logFeedback } from "@/core/ai/telemetry";
import type { AIMessage } from "@/app/lib/schema";

interface FeedbackButtonsProps {
    message: AIMessage;
}

export function FeedbackButtons({ message }: FeedbackButtonsProps) {
    const submitFeedback = useAssistantStore((s) => s.submitFeedback);
    const sessionId = useAssistantStore((s) => s.telemetrySessionId);

    const handleFeedback = useCallback(
        (type: "positive" | "negative") => {
            submitFeedback(message.id, type);
            logFeedback(sessionId, message.id, type);
        },
        [message.id, submitFeedback, sessionId]
    );

    const hasFeedback = message.feedback !== undefined;

    return (
        <div className="flex items-center gap-1 mt-2">
            <button
                onClick={() => handleFeedback("positive")}
                disabled={hasFeedback}
                className={`
                    p-1 rounded transition-colors
                    ${message.feedback === "positive"
                        ? "text-green-600 bg-green-50"
                        : hasFeedback
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                    }
                `}
                title="Good response"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
            </button>
            <button
                onClick={() => handleFeedback("negative")}
                disabled={hasFeedback}
                className={`
                    p-1 rounded transition-colors
                    ${message.feedback === "negative"
                        ? "text-red-600 bg-red-50"
                        : hasFeedback
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                    }
                `}
                title="Poor response"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                </svg>
            </button>
        </div>
    );
}
