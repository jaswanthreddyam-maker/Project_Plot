/**
 * ════════════════════════════════════════════════════════════════
 * AssistantOverlay — AI Chat Panel (Slide-in from Right)
 * ════════════════════════════════════════════════════════════════
 *
 * The main AI assistant interface. Completely isolated:
 *   - Wrapped in its own ErrorBoundary
 *   - Reads ONLY from assistantStore
 *   - Never imports chatStore or uiStore
 *   - If this crashes, the main workspace is unaffected
 */
"use client";

import { useState, useRef, useEffect, useCallback, Component, type ReactNode } from "react";
import { useAssistantStore } from "@/store/assistantStore";
import { runAssistant } from "@/app/actions/ai";
import { logPrompt, logResponse } from "@/core/ai/telemetry";
import { ChatMessage } from "./ChatMessage";
import type { AIMessage, ContextPayload } from "@/app/lib/schema";

// ── Error Boundary ───────────────────────────────────────────
// Isolated crash containment for the assistant panel.
interface ErrorBoundaryProps {
    children: ReactNode;
}
interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class AssistantErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("[AssistantOverlay] Error boundary caught:", error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 text-center">
                    <div className="text-red-500 mb-2">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-800 mb-1">Assistant encountered an error</p>
                    <p className="text-xs text-gray-500 mb-3">{this.state.error?.message}</p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="text-xs text-violet-600 hover:text-violet-800 underline"
                    >
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// ── Assistant Panel ──────────────────────────────────────────
interface AssistantOverlayProps {
    getContext?: () => ContextPayload;
}

function AssistantPanel({ getContext }: AssistantOverlayProps) {
    const [inputValue, setInputValue] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastSendRef = useRef(0);

    const isActive = useAssistantStore((s) => s.isAssistantActive);
    const chatHistory = useAssistantStore((s) => s.chatHistory);
    const isStreaming = useAssistantStore((s) => s.isStreaming);
    const addMessage = useAssistantStore((s) => s.addMessage);
    const setStreaming = useAssistantStore((s) => s.setStreaming);
    const enqueueCommands = useAssistantStore((s) => s.enqueueCommands);
    const sessionId = useAssistantStore((s) => s.telemetrySessionId);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory.length]);

    // Focus input when panel opens
    useEffect(() => {
        if (isActive) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isActive]);

    // ── Submit Handler ─────────────────────────────────
    const handleSubmit = useCallback(async () => {
        const prompt = inputValue.trim();
        if (!prompt || isStreaming || cooldownSeconds > 0) return;

        // Debounce: block rapid-fire sends (1500ms cooldown)
        const now = Date.now();
        if (now - lastSendRef.current < 1500) return;
        lastSendRef.current = now;

        // Clear input immediately
        setInputValue("");

        // Add user message to chat
        const userMessage: AIMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: prompt,
            timestamp: Date.now(),
        };
        addMessage(userMessage);
        setStreaming(true);

        // Gather context
        const context = getContext
            ? getContext()
            : {
                route: window.location.pathname,
                activeProviders: [],
                activeResponseSetId: null,
                timestamp: Date.now(),
            };

        // Log telemetry
        logPrompt(sessionId, prompt, JSON.stringify(context).length / 4);

        try {
            const startTime = Date.now();

            // Call Server Action
            const response = await runAssistant({
                prompt,
                context,
                sessionId,
                conversationHistory: chatHistory,
            });

            const latencyMs = Date.now() - startTime;

            // Detect rate limit and start cooldown timer
            if (response.message.content.startsWith("__RATE_LIMITED__")) {
                response.message.content = response.message.content.replace("__RATE_LIMITED__", "");
                setCooldownSeconds(60);
                if (cooldownRef.current) clearInterval(cooldownRef.current);
                cooldownRef.current = setInterval(() => {
                    setCooldownSeconds((prev) => {
                        if (prev <= 1) {
                            if (cooldownRef.current) clearInterval(cooldownRef.current);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }

            // Add assistant response to chat
            addMessage(response.message);

            // Enqueue any UI commands
            if (response.commands && response.commands.length > 0) {
                enqueueCommands(response.commands);
            }

            // Log response telemetry
            logResponse(sessionId, response.message.content, latencyMs);
        } catch (error) {
            console.error("[AssistantOverlay] Server Action error:", error);
            addMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: Date.now(),
            });
        } finally {
            setStreaming(false);
        }
    }, [
        inputValue,
        isStreaming,
        cooldownSeconds,
        addMessage,
        setStreaming,
        enqueueCommands,
        getContext,
        sessionId,
        chatHistory,
    ]);

    if (!isActive) return null;

    return (
        <div
            className={`
                fixed top-0 right-0 z-40
                w-full sm:w-[400px] h-full
                bg-white dark:bg-[#171717] border-l border-gray-200 dark:border-slate-800 shadow-2xl
                flex flex-col
                animate-[slideInRight_0.3s_ease-out]
                transition-colors
            `}
            style={{
                animationFillMode: "forwards",
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/80">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Plot Assistant</h2>
                </div>
                <button
                    onClick={() => useAssistantStore.getState().setAssistantActive(false)}
                    className="p-1.5 rounded-md hover:bg-gray-200/60 dark:hover:bg-slate-700 transition-colors"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 dark:text-gray-400">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
                {chatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mb-4 border border-violet-200/50 dark:border-slate-600">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-600 dark:text-violet-400">
                                <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-300 mb-1">
                            How can I help?
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            I can help you navigate Plot, search docs, and automate actions in the workspace.
                        </p>
                    </div>
                ) : (
                    <>
                        {chatHistory.map((msg) => (
                            <ChatMessage key={msg.id} message={msg} />
                        ))}
                    </>
                )}

                {/* Streaming indicator */}
                {isStreaming && (
                    <div className="flex justify-start mb-3">
                        <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 border border-gray-200">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-[#171717]">
                {cooldownSeconds > 0 && (
                    <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-600 dark:text-amber-500" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span className="text-xs text-amber-700 dark:text-amber-500 font-medium">
                            Rate limited. Cool down: {cooldownSeconds}s
                        </span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <input
                        suppressHydrationWarning
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        placeholder={cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s...` : "Ask Plot Assistant..."}
                        disabled={isStreaming || cooldownSeconds > 0}
                        className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:focus:ring-violet-400/30 focus:border-violet-400 dark:focus:border-violet-500 disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 transition-colors"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!inputValue.trim() || isStreaming || cooldownSeconds > 0}
                        className="p-2 rounded-lg bg-gray-900 dark:bg-slate-700 text-white disabled:opacity-30 hover:bg-gray-800 dark:hover:bg-slate-600 transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Exported Component with Error Boundary ───────────────────
export function AssistantOverlay({ getContext }: AssistantOverlayProps) {
    return (
        <AssistantErrorBoundary>
            <AssistantPanel getContext={getContext} />
        </AssistantErrorBoundary>
    );
}
