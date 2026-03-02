"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUIStore } from "@/store/uiStore";
import { API_BASE, fetchWithTimeout } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

const AGENTS = [
    { id: "researcher", name: "Researcher Agent", icon: "🔍", desc: "Deep dives and data gathering" },
    { id: "coder", name: "Coder Agent", icon: "💻", desc: "Code generation and review" },
    { id: "architect", name: "Architect Agent", icon: "📐", desc: "System design and planning" }
];

export default function AutonomousWorkspace() {
    const {
        setActiveAmpRoute,
        setToolExecutionStart,
        isToolExecuting,
        toolTaskId,
        toolExecutionState,
        setToolExecutionState,
        setToolExecutionEnd
    } = useUIStore();

    const [objective, setObjective] = useState("");
    const [selectedAgent, setSelectedAgent] = useState(AGENTS[0].id);
    const [isStarting, setIsStarting] = useState(false);

    // Live terminal logs state
    const [chunks, setChunks] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const handleReset = useCallback(() => {
        setToolExecutionEnd();
        setChunks([]);
        setError(null);
        if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    }, [setToolExecutionEnd]);

    // Handle SSE logic internally for the inline terminal
    useEffect(() => {
        if (!isToolExecuting || !toolTaskId) return;

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
                        setChunks(prev => [...prev, data.content]);
                        break;
                    case "completed":
                        setToolExecutionState("Completed!");
                        resetTimeoutRef.current = setTimeout(handleReset, 3000);
                        eventSource.close();
                        break;
                    case "error":
                        setError(data.message || "Execution failed");
                        setToolExecutionState("Failed");
                        resetTimeoutRef.current = setTimeout(handleReset, 5000);
                        eventSource.close();
                        break;
                }
            } catch {
                setChunks(prev => [...prev, event.data]);
            }
        };

        eventSource.onerror = (err) => {
            console.error("SSE connection error", err);
            setError("Connection lost. Retrying...");
        };

        return () => {
            eventSource.close();
            if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
        };
    }, [isToolExecuting, toolTaskId, setToolExecutionState, handleReset]);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chunks]);

    const handleRun = async () => {
        if (!objective.trim() || isToolExecuting || isStarting) return;
        setIsStarting(true);
        setError(null);

        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/tools/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tool_name: "PlotAutonomous",
                    arguments: {
                        objective,
                        agent_type: selectedAgent
                    }
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setToolExecutionStart(data.task_id, data.execution_id || data.task_id);
            } else {
                setError("Failed to start agent execution. Ensure backend is running.");
            }
        } catch (err) {
            console.error(err);
            setError("Network error starting agent.");
        } finally {
            setIsStarting(false);
            setObjective(""); // clear input
        }
    };

    return (
        <div className="flex flex-col h-full w-full p-6 md:p-8 bg-slate-50/50 dark:bg-[#171717] overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl w-full mx-auto flex flex-col gap-8 h-full"
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/20 flex items-center justify-center border border-white/20">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                                Autonomous Agent Workspace
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Configure, dispatch, and monitor long-running workflows instantly.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setActiveAmpRoute("crew-studio")}
                        className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
                    >
                        Return to Chat
                    </button>
                </div>

                {/* Dashboard Controls */}
                <div className="flex flex-col gap-6 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">

                    {/* Agent Selection */}
                    <div>
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 block">
                            Select Agent Persona
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {AGENTS.map(agent => (
                                <button
                                    key={agent.id}
                                    onClick={() => setSelectedAgent(agent.id)}
                                    className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${selectedAgent === agent.id
                                        ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10"
                                        : "border-slate-100 dark:border-slate-800 bg-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xl">{agent.icon}</span>
                                        <span className={`font-semibold text-sm ${selectedAgent === agent.id ? "text-indigo-700 dark:text-indigo-400" : "text-slate-700 dark:text-slate-200"}`}>
                                            {agent.name}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {agent.desc}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Task Input */}
                    <div>
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 block">
                            Mission Objective
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                name="mission-objective"
                                value={objective}
                                onChange={(e) => setObjective(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleRun()}
                                autoComplete="off"
                                data-lpignore="true"
                                data-1p-ignore
                                placeholder="E.g., Research recent advancements in LLM reasoning..."
                                className="flex-1 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-shadow"
                                disabled={isToolExecuting || isStarting}
                            />
                            <button
                                onClick={handleRun}
                                disabled={!objective.trim() || isToolExecuting || isStarting}
                                className="px-6 py-3 rounded-xl font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 min-w-[140px]"
                            >
                                {isStarting ? (
                                    <>
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                                        <span>Starting</span>
                                    </>
                                ) : isToolExecuting ? (
                                    "Running..."
                                ) : (
                                    "Run Agent"
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Live Terminal Log */}
                <div className="flex-1 min-h-[300px] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                            </div>
                            <span className="ml-2 text-xs font-mono text-slate-500 uppercase tracking-widest">
                                Live Execution Terminal
                            </span>
                        </div>
                        {isToolExecuting && (
                            <span className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {toolExecutionState || "Processing..."}
                            </span>
                        )}
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto space-y-2 font-mono text-[13px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {!isToolExecuting && chunks.length === 0 && !error ? (
                            <div className="h-full flex items-center justify-center text-slate-600 italic">
                                Awaiting mission objective...
                            </div>
                        ) : (
                            <AnimatePresence initial={false}>
                                {chunks.map((chunk, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="text-slate-300 break-words flex gap-3"
                                    >
                                        <span className="text-indigo-500 shrink-0">❯</span>
                                        <span>{chunk}</span>
                                    </motion.div>
                                ))}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="text-red-400 break-words flex gap-3 italic"
                                    >
                                        <span className="text-red-500 shrink-0">✖</span>
                                        <span>{error}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        )}
                        <div ref={bottomRef} className="h-4" />
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
