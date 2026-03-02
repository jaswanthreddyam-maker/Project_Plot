"use client";

import { useEffect, useRef, useState } from "react";
import type { AIMessage } from "@/app/lib/schema";
import { useAssistantStore } from "@/store/assistantStore";

const OLLAMA_GENERATE_URL = "http://localhost:11434/api/generate";

interface PlotChatProps {
    onClose: () => void;
}

function MessageBubble({ message }: { message: AIMessage }) {
    const isUser = message.role === "user";

    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                        ? "bg-slate-900 text-white rounded-br-md"
                        : "bg-slate-100 text-slate-800 rounded-bl-md border border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
                }`}
            >
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className={`mt-1.5 text-[10px] ${isUser ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
            </div>
        </div>
    );
}

export function PlotChat({ onClose }: PlotChatProps) {
    const [inputValue, setInputValue] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const chatHistory = useAssistantStore((s) => s.chatHistory);
    const addMessage = useAssistantStore((s) => s.addMessage);
    const updateMessageContent = useAssistantStore((s) => s.updateMessageContent);
    const isStreaming = useAssistantStore((s) => s.isStreaming);
    const setStreaming = useAssistantStore((s) => s.setStreaming);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory, isStreaming]);

    useEffect(() => {
        const id = window.setTimeout(() => inputRef.current?.focus(), 150);
        return () => window.clearTimeout(id);
    }, []);

    const handleSubmit = async () => {
        const prompt = inputValue.trim();
        if (!prompt || isStreaming) return;

        setInputValue("");
        const timestamp = Date.now();

        addMessage({
            id: crypto.randomUUID(),
            role: "user",
            content: prompt,
            timestamp,
        });

        const assistantId = crypto.randomUUID();
        addMessage({
            id: assistantId,
            role: "assistant",
            content: "",
            timestamp: Date.now(),
        });

        setStreaming(true);

        try {
            const response = await fetch(OLLAMA_GENERATE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama3",
                    prompt,
                    stream: true,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                throw new Error(
                    errorText?.trim() || `Request failed with status ${response.status}.`
                );
            }

            if (!response.body) {
                throw new Error("No response stream was returned by Ollama.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let accumulatedText = "";
            let doneReceived = false;

            const consumeLine = (line: string) => {
                if (!line) return;
                let chunk: Record<string, unknown>;
                try {
                    chunk = JSON.parse(line) as Record<string, unknown>;
                } catch {
                    return;
                }

                const error = chunk.error;
                if (typeof error === "string" && error.trim()) {
                    throw new Error(error);
                }

                const piece = chunk.response;
                if (typeof piece === "string" && piece.length > 0) {
                    accumulatedText += piece;
                    updateMessageContent(assistantId, accumulatedText);
                }

                if (chunk.done === true) {
                    doneReceived = true;
                }
            };

            while (!doneReceived) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const rawLine of lines) {
                    consumeLine(rawLine.trim());
                }
            }

            const trailing = buffer.trim();
            if (trailing) {
                consumeLine(trailing);
            }

            if (!accumulatedText.trim()) {
                updateMessageContent(assistantId, "I did not receive a response from Ollama.");
            }
        } catch (error) {
            updateMessageContent(
                assistantId,
                error instanceof Error
                    ? `Local Ollama request failed: ${error.message}`
                    : "Local Ollama request failed."
            );
        } finally {
            setStreaming(false);
        }
    };

    return (
        <div
            className="
                fixed top-0 right-0 z-50 h-full w-full sm:w-[420px]
                bg-white/95 dark:bg-[#171717]/95 backdrop-blur-xl
                border-l border-slate-200 dark:border-slate-800 shadow-2xl
                flex flex-col md:mr-4 md:mt-4 md:mb-4 md:h-[calc(100vh-32px)] md:rounded-2xl overflow-hidden
            "
        >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60">
                <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Plot Assistant (Local Ollama)</h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                    aria-label="Close assistant"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
                {chatHistory.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                            Your chat runs directly on this device using Ollama.
                        </p>
                    </div>
                ) : (
                    chatHistory
                        .filter((message) => message.role === "user" || message.role === "assistant")
                        .map((message) => <MessageBubble key={message.id} message={message} />)
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-5 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                    <input
                        ref={inputRef}
                        type="text"
                        name="plot-assistant-query"
                        value={inputValue}
                        onChange={(event) => setInputValue(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void handleSubmit();
                            }
                        }}
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore
                        placeholder="Ask Plot Assistant..."
                        disabled={isStreaming}
                        className="flex-1 bg-transparent border-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none px-3"
                    />
                    <button
                        onClick={() => void handleSubmit()}
                        disabled={!inputValue.trim() || isStreaming}
                        className="rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                        {isStreaming ? "..." : "Send"}
                    </button>
                </div>
            </div>
        </div>
    );
}
