/**
 * VerdictCard — Full-width "Final Verdict" display
 * Appears below provider columns after all streams complete
 * Streams the verdict in real-time, with collapse and regenerate
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useChatStore } from "@/store/chatStore";
import { useUIStore } from "@/store/uiStore";

export default function VerdictCard() {
    const streams = useChatStore((s) => s.streams);
    const verdictStatus = useChatStore((s) => s.verdictStatus);
    const setVerdictStatus = useChatStore((s) => s.setVerdictStatus);
    const initializeStream = useChatStore((s) => s.initializeStream);
    const appendToken = useChatStore((s) => s.appendToken);
    const finalizeStream = useChatStore((s) => s.finalizeStream);
    const setStreamError = useChatStore((s) => s.setStreamError);
    const addMessage = useChatStore((s) => s.addMessage);
    const messages = useChatStore((s) => s.messages);
    const comparisonMode = useUIStore((s) => s.comparisonMode);
    const activeProviders = useUIStore((s) => s.activeProviders);
    const apiKeys = useUIStore((s) => s.apiKeys);

    const [collapsed, setCollapsed] = useState(false);

    const verdictText = streams["verdict"]?.currentText || "";
    const verdictStreaming = streams["verdict"]?.isStreaming || false;
    const verdictError = streams["verdict"]?.error || null;

    // Determine which provider to use for the verdict summarizer
    const getSummarizer = useCallback(() => {
        // Prefer gemini > openai > claude > grok (whichever has an API key)
        const preferred = ["gemini", "openai", "claude", "grok"];
        for (const p of preferred) {
            if (apiKeys[p]) return { provider: p, apiKey: apiKeys[p] };
        }
        return null;
    }, [apiKeys]);

    // Check if all provider streams are done
    const allStreamsDone = useCallback(() => {
        const providerStreams = activeProviders.filter((p) => streams[p]);
        if (providerStreams.length === 0) return false;
        return providerStreams.every(
            (p) => streams[p] && !streams[p].isStreaming && (streams[p].currentText || streams[p].error)
        );
    }, [activeProviders, streams]);

    // Get the last user prompt
    const getLastPrompt = useCallback(() => {
        const userMessages = messages.filter((m) => m.role === "user");
        return userMessages[userMessages.length - 1]?.content || "";
    }, [messages]);

    // Fire verdict when all streams complete
    useEffect(() => {
        if (!comparisonMode) return;
        if (verdictStatus !== "waiting") return;
        if (!allStreamsDone()) return;

        fireVerdict();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comparisonMode, verdictStatus, streams]);

    const fireVerdict = async () => {
        const summarizer = getSummarizer();
        if (!summarizer) {
            setVerdictStatus("error");
            return;
        }

        const prompt = getLastPrompt();
        if (!prompt) return;

        // Collect all completed responses
        const responses = activeProviders
            .filter((p) => streams[p]?.currentText)
            .map((p) => ({
                provider: p,
                content: streams[p].currentText,
            }));

        if (responses.length < 2) {
            // Need at least 2 responses to compare
            setVerdictStatus("idle");
            return;
        }

        // Start streaming
        setVerdictStatus("streaming");
        initializeStream("verdict");

        try {
            const res = await fetch("/api/chat/verdict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    responses,
                    apiKey: summarizer.apiKey,
                    summarizer: summarizer.provider,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Verdict failed");
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error("No response stream");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                appendToken("verdict", chunk);
            }

            finalizeStream("verdict");
            setVerdictStatus("done");

            // Save verdict to message history
            const finalText = useChatStore.getState().streams["verdict"]?.currentText || "";
            if (finalText) {
                addMessage({
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: finalText,
                    provider: "verdict",
                });
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Verdict generation failed";
            setStreamError("verdict", errorMsg);
            setVerdictStatus("error");
        }
    };

    // Don't render if comparison mode is off or no verdict exists
    if (!comparisonMode) return null;
    if (verdictStatus === "idle" && !verdictText) return null;

    // Waiting state
    if (verdictStatus === "waiting") {
        return (
            <div className="mx-6 mb-4 p-4 rounded-xl border border-violet-200 bg-violet-50/50">
                <div className="flex items-center gap-2 text-violet-600 text-sm">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="font-medium">Waiting for all providers to finish...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-6 mb-4">
            <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white overflow-hidden shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-violet-100">
                    <div className="flex items-center gap-2">
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="text-violet-500"
                        >
                            <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74L12 2z" />
                        </svg>
                        <h3 className="text-sm font-bold text-violet-900">Final Verdict</h3>
                        {verdictStreaming && (
                            <span className="flex items-center gap-1 text-xs text-violet-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                                Analyzing...
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Regenerate */}
                        {verdictStatus === "done" && (
                            <button
                                onClick={() => {
                                    setVerdictStatus("waiting");
                                }}
                                className="p-1.5 rounded-lg hover:bg-violet-100 transition-colors"
                                title="Regenerate verdict"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-500">
                                    <path d="M1 4v6h6" />
                                    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                                </svg>
                            </button>
                        )}
                        {/* Collapse */}
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            className="p-1.5 rounded-lg hover:bg-violet-100 transition-colors"
                            title={collapsed ? "Expand" : "Collapse"}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className={`text-violet-500 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body */}
                {!collapsed && (
                    <div className="px-4 py-3">
                        {verdictError ? (
                            <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                                <strong>Error:</strong> {verdictError}
                            </div>
                        ) : (
                            <div className="prose prose-sm prose-violet max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap">
                                {verdictText || (
                                    <span className="text-gray-400 italic">Generating verdict...</span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
