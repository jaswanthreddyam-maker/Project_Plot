/**
 * ════════════════════════════════════════════════════════════════
 * Ollama Setup Modal — Guides user through local Ollama install
 * ════════════════════════════════════════════════════════════════
 *
 * Shown when the user tries to activate Ollama but localhost:11434
 * is unreachable. Polls every 3 s and auto-closes on success.
 *
 * Mixed Content: When the app is served over HTTPS (e.g. Vercel),
 * browsers block fetch() to http://localhost. We detect this and
 * show a clear warning instead of silently failing.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useUIStore } from "@/store/uiStore";

const OLLAMA_PING_URL = "http://localhost:11434/api/tags";
const POLL_INTERVAL_MS = 3_000;

/** True when the page is served over HTTPS (mixed content will block HTTP fetches) */
function isSecureContext(): boolean {
    if (typeof window === "undefined") return false;
    return window.location.protocol === "https:";
}

export default function OllamaSetupModal() {
    const {
        ollamaModalOpen,
        setOllamaModalOpen,
        toggleProvider,
        activeProviders,
    } = useUIStore();

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [mixedContent, setMixedContent] = useState(false);

    // ── Detect mixed-content on mount ───────────────────
    useEffect(() => {
        if (ollamaModalOpen && isSecureContext()) {
            setMixedContent(true);
        }
    }, [ollamaModalOpen]);

    // ── Background polling (skip on HTTPS) ──────────────
    useEffect(() => {
        if (!ollamaModalOpen || mixedContent) return;

        const poll = async () => {
            try {
                const res = await fetch(OLLAMA_PING_URL, {
                    method: "GET",
                    signal: AbortSignal.timeout(2_000),
                });
                if (res.ok) {
                    // Ollama is now running — auto-unlock
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    intervalRef.current = null;

                    // Activate the provider if not already active
                    if (!activeProviders.includes("ollama")) {
                        toggleProvider("ollama");
                    }
                    setOllamaModalOpen(false);
                }
            } catch {
                // Still waiting — do nothing
            }
        };

        // Immediate first check
        void poll();
        intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [ollamaModalOpen, mixedContent, activeProviders, toggleProvider, setOllamaModalOpen]);

    if (!ollamaModalOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30"
                onClick={() => setOllamaModalOpen(false)}
            />

            {/* Modal Card */}
            <div className="relative w-full max-w-md mx-4 bg-white border border-gray-200 rounded-xl shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🦙</span>
                        <h2 className="text-lg font-bold text-gray-900">
                            Ollama Setup
                        </h2>
                    </div>
                    <button
                        onClick={() => setOllamaModalOpen(false)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-gray-400"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Mixed Content Warning (HTTPS → HTTP blocked) */}
                    {mixedContent && (
                        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                            <p className="text-sm text-red-800 font-medium mb-1">
                                ⚠️ Mixed Content Blocked
                            </p>
                            <p className="text-xs text-red-700">
                                This app is served over <strong>HTTPS</strong>, so
                                your browser blocks connections to{" "}
                                <code className="text-red-800 bg-red-100 px-1 py-0.5 rounded text-[11px]">
                                    http://localhost:11434
                                </code>
                                . To use Ollama, run this app locally over HTTP
                                (e.g.{" "}
                                <code className="text-red-800 bg-red-100 px-1 py-0.5 rounded text-[11px]">
                                    npm run dev
                                </code>
                                ).
                            </p>
                        </div>
                    )}

                    {/* Info card (only when not mixed-content) */}
                    {!mixedContent && (
                        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                            <p className="text-sm text-amber-800 font-medium mb-1">
                                Ollama is not running
                            </p>
                            <p className="text-xs text-amber-700">
                                We couldn&apos;t reach{" "}
                                <code className="text-amber-800 bg-amber-100 px-1 py-0.5 rounded text-[11px]">
                                    localhost:11434
                                </code>
                                . Download and start Ollama to use local models.
                            </p>
                        </div>
                    )}

                    {/* Download button */}
                    <a
                        href="https://ollama.com/download"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download Ollama Locally
                    </a>

                    {/* Polling status — only show when polling is active (HTTP context) */}
                    {!mixedContent && (
                        <div className="flex items-center justify-center gap-2 py-2">
                            {/* Spinner */}
                            <svg
                                className="animate-spin h-4 w-4 text-gray-400"
                                viewBox="0 0 24 24"
                                fill="none"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                            </svg>
                            <span className="text-xs text-gray-500">
                                Waiting for local Ollama instance...
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
