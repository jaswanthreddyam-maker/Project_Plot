"use client";

import type { AIMessage } from "@/app/lib/schema";
import { FeedbackButtons } from "@/components/ai/FeedbackButtons";

interface ChatMessageProps {
    message: AIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";

    if (isSystem) return null;

    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
            <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser
                        ? "bg-gray-900 text-white rounded-br-md"
                        : "bg-gray-100 text-gray-800 rounded-bl-md border border-gray-200"
                    }`}
            >
                {/* Tool call indicators */}
                {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mb-2 space-y-1">
                        {message.toolCalls.map((tc, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md ${isUser
                                        ? "bg-gray-800 text-gray-300"
                                        : "bg-violet-50 text-violet-700 border border-violet-200"
                                    }`}
                            >
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                                </svg>
                                <span className="font-medium">{tc.toolName}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Message content */}
                <div className="whitespace-pre-wrap">{message.content}</div>

                {/* Timestamp */}
                <div className={`mt-1.5 text-[10px] text-gray-400`}>
                    {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </div>

                {/* Feedback buttons for assistant messages */}
                {!isUser && <FeedbackButtons message={message} />}
            </div>
        </div>
    );
}
