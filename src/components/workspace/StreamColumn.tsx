/**
 * StreamColumn - Provider response card.
 * Can render live store streams or explicit override values.
 */
"use client";

import { ReactNode, useRef, useEffect, useMemo } from "react";
import {
    useChatStore,
    selectStreamText,
    selectStreamStatus,
    selectStreamError,
} from "@/store/chatStore";

interface StreamColumnProps {
    provider: string;
    textOverride?: string;
    isStreamingOverride?: boolean;
    errorOverride?: string | null;
    emptyMessage?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
    openai: "OpenAI",
    gemini: "Gemini",
    claude: "Claude",
    grok: "Grok",
    ollama: "Ollama",
    referee: "Referee",
};

function renderInline(line: string, keyPrefix: string) {
    const segments: ReactNode[] = [];
    const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIndex = 0;
    let tokenMatch: RegExpExecArray | null = null;
    let partIndex = 0;

    while ((tokenMatch = tokenRegex.exec(line)) !== null) {
        if (tokenMatch.index > lastIndex) {
            segments.push(line.slice(lastIndex, tokenMatch.index));
        }

        const token = tokenMatch[0];
        if (token.startsWith("**") && token.endsWith("**")) {
            segments.push(
                <strong key={`${keyPrefix}-b-${partIndex++}`} className="font-semibold">
                    {token.slice(2, -2)}
                </strong>
            );
        } else if (token.startsWith("`") && token.endsWith("`")) {
            segments.push(
                <code
                    key={`${keyPrefix}-c-${partIndex++}`}
                    className="px-1 py-0.5 rounded bg-gray-100 text-sm font-mono"
                >
                    {token.slice(1, -1)}
                </code>
            );
        }

        lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < line.length) {
        segments.push(line.slice(lastIndex));
    }

    return segments;
}

export default function StreamColumn({
    provider,
    textOverride,
    isStreamingOverride,
    errorOverride,
    emptyMessage = "No response yet.",
}: StreamColumnProps) {
    const label = PROVIDER_LABELS[provider] || provider;

    const liveText = useChatStore(selectStreamText(provider));
    const liveStreaming = useChatStore(selectStreamStatus(provider));
    const liveError = useChatStore(selectStreamError(provider));

    const text = textOverride ?? liveText;
    const isStreaming = isStreamingOverride ?? liveStreaming;
    const error = errorOverride ?? liveError;

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isStreaming && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [text, isStreaming]);

    const formattedText = useMemo(() => {
        if (!text) return null;
        return text.split("\n").map((line, i) => {
            if (line.startsWith("# ")) {
                return (
                    <h3 key={i} className="text-base font-bold text-gray-900 mt-3 mb-1">
                        {line.slice(2)}
                    </h3>
                );
            }
            if (line.startsWith("## ")) {
                return (
                    <h4 key={i} className="text-sm font-semibold text-gray-800 mt-2 mb-1">
                        {line.slice(3)}
                    </h4>
                );
            }
            if (!line.trim()) {
                return <div key={i} className="h-2" />;
            }

            return <p key={i} className="text-sm text-gray-700 leading-relaxed">{renderInline(line, `line-${i}`)}</p>;
        });
    }, [text]);

    return (
        <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">{label}</h3>
                {isStreaming && (
                    <span className="text-xs text-green-600">Streaming...</span>
                )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin min-h-[60px]">
                {error && (
                    <div className="p-2 rounded bg-red-50 border border-red-200 mb-2">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {formattedText && <div className="space-y-0.5">{formattedText}</div>}

                {isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-gray-800 ml-0.5 animate-pulse rounded-sm" />
                )}

                {!text && !isStreaming && !error && (
                    <p className="text-sm text-gray-400">{emptyMessage}</p>
                )}
            </div>
        </div>
    );
}
