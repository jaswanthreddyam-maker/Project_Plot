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
import { motion, AnimatePresence } from "framer-motion";
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

    return (
        <AnimatePresence>
            {isActive && (
                <motion.div
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className={`
                        fixed top-0 right-0 z-40
                        w-full sm:w-[420px] h-full
                        bg-white/95 dark:bg-[#171717]/95 
                        backdrop-blur-xl
                        border-l border-gray-200 dark:border-slate-800 shadow-2xl
                        flex flex-col
                        md:mr-4 md:mt-4 md:mb-4 md:h-[calc(100vh-32px)]
                        md:rounded-2xl overflow-hidden
                    `}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 backdrop-blur-md bg-white/50 dark:bg-slate-900/50 sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight">Plot Assistant</h2>
                        </div>
                        <button
                            onClick={() => useAssistantStore.getState().setAssistantActive(false)}
                            className="p-2 rounded-xl bg-transparent hover:bg-gray-200/60 dark:hover:bg-slate-700 transition-colors border-none text-gray-500 dark:text-gray-400"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scrollbar-thin">
                        {chatHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center px-6">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="w-16 h-16 rounded-3xl bg-black dark:bg-white flex items-center justify-center mb-6 shadow-xl"
                                >
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white dark:text-black">
                                        <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
                                    </svg>
                                </motion.div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                                    How can I help?
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-[240px] mx-auto">
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
                                <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-5 py-3 border border-gray-200 dark:border-slate-700">
                                    <div className="flex gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input - Floating Pill */}
                    <div className="px-4 py-6 border-none bg-transparent">
                        <div className="relative max-w-[95%] mx-auto">
                            {cooldownSeconds > 0 && (
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 shadow-sm backdrop-blur-md">
                                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">
                                        Cooldown: {cooldownSeconds}s
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 p-1.5 rounded-full border border-gray-200 dark:border-slate-700 shadow-lg focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/10 transition-all">
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
                                    placeholder={cooldownSeconds > 0 ? `Please wait...` : "Ask Plot Assistant..."}
                                    disabled={isStreaming || cooldownSeconds > 0}
                                    className="flex-1 ml-4 py-2 bg-transparent border-none text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0"
                                />
                                <button
                                    onClick={handleSubmit}
                                    disabled={!inputValue.trim() || isStreaming || cooldownSeconds > 0}
                                    className={`
                                        p-2.5 rounded-full transition-all duration-300
                                        ${inputValue.trim() ? "scale-100 opacity-100" : "scale-90 opacity-0"}
                                        bg-black text-white dark:bg-white dark:text-black border-none
                                    `}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="22" y1="2" x2="11" y2="13" />
                                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
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
