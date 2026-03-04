/**
 * StreamColumn - Provider response card.
 * Can render live store streams or explicit override values.
 */
"use client";

import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

                {text && (
                    <div className="text-sm text-gray-700 leading-relaxed markdown-body">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({ children }) => <h1 className="text-lg font-bold text-gray-900 mt-3 mb-1">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-base font-semibold text-gray-900 mt-3 mb-1">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-900 mt-2 mb-1">{children}</h3>,
                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                                li: ({ children }) => <li className="text-sm">{children}</li>,
                                blockquote: ({ children }) => (
                                    <blockquote className="border-l-2 border-gray-300 pl-3 italic text-gray-600 my-2">
                                        {children}
                                    </blockquote>
                                ),
                                code: ({ className, children }) => {
                                    const isBlock = Boolean(className);
                                    if (isBlock) {
                                        return (
                                            <code className="block rounded bg-gray-100 px-3 py-2 font-mono text-xs overflow-x-auto">
                                                {children}
                                            </code>
                                        );
                                    }
                                    return (
                                        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
                                            {children}
                                        </code>
                                    );
                                },
                                pre: ({ children }) => <pre className="my-2">{children}</pre>,
                                a: ({ href, children }) => (
                                    <a
                                        href={href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 underline underline-offset-2"
                                    >
                                        {children}
                                    </a>
                                ),
                            }}
                        >
                            {text}
                        </ReactMarkdown>
                    </div>
                )}

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
