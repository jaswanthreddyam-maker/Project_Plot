"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useUIStore } from "@/store/uiStore";
import { API_BASE } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

export default function ToolExecutionStream() {
    const {
        _hasHydrated,
        isToolExecuting,
        toolTaskId,
        toolExecutionState,
        setToolExecutionState,
        setToolExecutionEnd
    } = useUIStore();

    const [chunks, setChunks] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Using a ref for the timeout ensures we can cancel it if the component unmounts
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up function to reset everything
    const handleReset = useCallback(() => {
        setToolExecutionEnd();
        setChunks([]);
        setError(null);
        if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    }, [setToolExecutionEnd]);

    useEffect(() => {
        if (!isToolExecuting || !toolTaskId) return;

        // Clear any lingering resets from previous runs
        if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
        setError(null);
        setChunks([]);

        const eventSource = new EventSource(`${API_BASE}/stream/${toolTaskId}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.type || data.status) {
                    case "status":
                        setToolExecutionState(data.data?.state || data.content || "Processing...");
                        break;

                    case "chunk":
                        setChunks(prev => [...prev.slice(-4), data.content]); // keep previous 4 chunks + 1 new = 5
                        break;

                    case "completed":
                        setToolExecutionState("Completed!");
                        resetTimeoutRef.current = setTimeout(handleReset, 2500);
                        eventSource.close(); // Close immediately on completion
                        break;

                    case "error":
                        setError(data.message || "Execution failed");
                        setToolExecutionState("Failed");
                        resetTimeoutRef.current = setTimeout(handleReset, 5000);
                        eventSource.close();
                        break;
                }
            } catch (err) {
                // Fallback for non-JSON strings
                setChunks(prev => [...prev.slice(-4), event.data]);
            }
        };

        eventSource.onerror = (err) => {
            console.error("SSE connection error", err);
            setError("Connection lost. Retrying...");
            // We don't close here because EventSource auto-retries by default
        };

        return () => {
            eventSource.close();
            if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
        };
    }, [isToolExecuting, toolTaskId, setToolExecutionState, handleReset]);

    if (!_hasHydrated) return null;

    return (
        <AnimatePresence>
            {isToolExecuting && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="fixed bottom-6 right-6 z-50 w-80"
                >
                    <div className="backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col gap-3">

                        {/* Header */}
                        <div className="flex items-center gap-3">
                            <div className="relative flex items-center justify-center shrink-0">
                                {error ? (
                                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                    </div>
                                ) : toolExecutionState === "Completed!" ? (
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                            className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">
                                    Agent Pipeline
                                </span>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                                    {toolExecutionState || "Initializing..."}
                                </span>
                            </div>

                            <button
                                onClick={handleReset}
                                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        {/* Stream Output */}
                        <div className="bg-slate-50 border border-slate-100 dark:bg-slate-950/50 dark:border-slate-800/50 rounded-xl p-3 min-h-[120px] shadow-inner relative overflow-hidden flex flex-col justify-end">
                            {error ? (
                                <span className="text-xs text-red-500 font-mono leading-relaxed italic z-10 relative">
                                    {error}
                                </span>
                            ) : chunks.length > 0 ? (
                                <div className="flex flex-col gap-2 z-10 relative">
                                    <AnimatePresence mode="popLayout" initial={false}>
                                        {chunks.map((chunk, i) => (
                                            <motion.div
                                                key={`${toolTaskId}-${i}-${chunk.slice(0, 10)}`}
                                                layout
                                                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 400,
                                                    damping: 25,
                                                    mass: 0.8
                                                }}
                                                className="bg-white dark:bg-slate-900 rounded-lg p-2.5 shadow-sm border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 font-mono flex items-start gap-2 break-words"
                                            >
                                                <span className="text-indigo-400 dark:text-indigo-500 shrink-0 select-none mt-0.5">↳</span>
                                                <span className="flex-1 whitespace-pre-wrap">{chunk}</span>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 z-10 relative">
                                    <div className="h-8 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg animate-pulse" />
                                    <div className="h-8 w-[80%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg animate-pulse" />
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
