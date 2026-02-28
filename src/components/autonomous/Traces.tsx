"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Brain, Terminal, RefreshCw } from "lucide-react";

interface TraceRun {
    execution_id: string;
    status: string;
    timestamp: string;
}

interface TraceDetail {
    id: string;
    agent_role: string;
    task_description: string;
    status: string;
    logs: string;
    timestamp: string;
    is_tool_call?: boolean;
}

export default function Traces() {
    const [runs, setRuns] = useState<TraceRun[]>([]);
    const [selectedRun, setSelectedRun] = useState<string | null>(null);
    const [traceDetails, setTraceDetails] = useState<TraceDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        fetchRuns();
    }, []);

    const fetchRuns = async () => {
        try {
            setLoading(true);
            const res = await fetch("http://localhost:8000/api/traces");
            if (res.ok) {
                const data = await res.json();
                setRuns(data);
                if (data.length > 0) {
                    setSelectedRun(data[0].execution_id);
                }
            }
        } catch (error) {
            console.error("Error fetching trace runs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedRun) return;

        const fetchDetails = async () => {
            try {
                setLoadingDetails(true);
                const res = await fetch(`http://localhost:8000/api/traces/${selectedRun}`);
                if (res.ok) {
                    const data = await res.json();

                    // Add mock `is_tool_call` logic for visual demonstration
                    // In a real app the backend sends this flag
                    const enhancedData = data.map((d: any) => ({
                        ...d,
                        is_tool_call: d.task_description.toLowerCase().includes("using tool") || d.task_description.toLowerCase().includes("executing")
                    }));

                    setTraceDetails(enhancedData);
                }
            } catch (error) {
                console.error("Error fetching trace details:", error);
            } finally {
                setLoadingDetails(false);
            }
        };

        fetchDetails();
    }, [selectedRun]);

    return (
        <div className="flex h-full bg-[#171717] overflow-hidden autonomous-theme">
            {/* Left Pane - Executions List */}
            <div className="w-1/3 min-w-[300px] max-w-[400px] border-r border-[#262626] bg-[#1a1a1a] flex flex-col h-full shrink-0">
                <div className="p-4 border-b border-[#262626] flex items-center justify-between bg-[#121212]">
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Execution Traces</h2>
                    <button
                        onClick={fetchRuns}
                        className="p-1.5 hover:bg-[#262626] rounded-md text-slate-400 transition-colors"
                        title="Refresh Runs"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                    {loading ? (
                        <div className="p-4 space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="animate-pulse flex flex-col gap-2 p-3 bg-[#262626]/30 rounded-lg">
                                    <div className="flex justify-between items-center">
                                        <div className="h-3 bg-[#333] rounded w-16" />
                                        <div className="h-3 bg-[#333] rounded-full w-12" />
                                    </div>
                                    <div className="h-2 bg-[#333] rounded w-24" />
                                </div>
                            ))}
                        </div>
                    ) : runs.length === 0 ? (
                        <div className="p-8 text-sm text-slate-500 text-center flex flex-col items-center gap-3">
                            <div className="w-12 h-12 bg-slate-800/50 rounded-xl flex items-center justify-center">
                                <Terminal size={20} className="text-slate-600" />
                            </div>
                            No traces found yet. Run an autonomous workflow first.
                        </div>
                    ) : (
                        <div className="divide-y divide-[#262626]">
                            {runs.map((run) => (
                                <button
                                    key={run.execution_id}
                                    onClick={() => setSelectedRun(run.execution_id)}
                                    className={`w-full text-left p-4 hover:bg-[#262626] transition-all group relative ${selectedRun === run.execution_id ? "bg-[#262626]" : ""}`}
                                >
                                    {/* Active Indicator */}
                                    {selectedRun === run.execution_id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full" />
                                    )}

                                    <div className="flex justify-between items-center mb-2 pl-2">
                                        <span className="text-xs font-mono font-semibold text-slate-200 truncate pr-2">
                                            {run.execution_id.split("-").pop()}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${run.status.toLowerCase() === 'running' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                            run.status.toLowerCase() === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            }`}>
                                            {run.status}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 pl-2 font-medium flex items-center gap-1.5">
                                        {format(new Date(run.timestamp), "MMM d, yyyy • HH:mm:ss")}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Pane - Strict Terminal Viewer */}
            <div className="flex-1 flex flex-col h-full bg-[#0a0a0a] relative isolate">
                {/* Subtle Grid Background */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none -z-10" />

                {selectedRun ? (
                    <>
                        <div className="px-6 py-4 border-b border-[#262626] bg-[#0f0f0f]/80 backdrop-blur-md flex justify-between items-center shrink-0 sticky top-0 z-10">
                            <h3 className="text-xs font-mono text-slate-400 flex items-center gap-2">
                                <span className="text-emerald-500">root@plot-os</span>
                                <span className="text-slate-600">:</span>
                                <span className="text-blue-400">~/traces</span>
                                <span className="text-slate-600">$</span>
                                <span className="text-slate-300">cat {selectedRun.split("-").pop()}.log</span>
                            </h3>
                            {loadingDetails && <span className="text-[10px] text-emerald-500 animate-pulse font-mono tracking-widest uppercase font-bold">syncing...</span>}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-[#262626] scrollbar-track-transparent pb-32">
                            {traceDetails.length === 0 && !loadingDetails ? (
                                <div className="h-full flex flex-col items-center justify-center font-mono text-slate-600 gap-4">
                                    <Terminal size={32} className="opacity-50" />
                                    <p>No logs generated for this execution yet.</p>
                                </div>
                            ) : (
                                <div className="relative space-y-8 max-w-4xl mx-auto">
                                    {/* Vertical Timeline Line */}
                                    <div className="absolute left-[27px] top-6 bottom-6 w-px bg-gradient-to-b from-[#262626] via-[#262626] to-transparent z-0" />

                                    {traceDetails.map((detail) => (
                                        <div key={detail.id} className="relative z-10 flex gap-6">
                                            {/* Icon Node */}
                                            <div className="shrink-0 mt-1">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-xl ${detail.is_tool_call
                                                    ? "bg-[#161616] border-slate-800 text-blue-400 shadow-blue-900/10"
                                                    : "bg-[#161616] border-slate-800 text-purple-400 shadow-purple-900/10"
                                                    }`}>
                                                    {detail.is_tool_call ? <Terminal size={24} /> : <Brain size={24} />}
                                                </div>
                                            </div>

                                            {/* Card Content */}
                                            <div className="flex-1 bg-[#121212]/80 backdrop-blur-md border border-[#262626] rounded-2xl p-5 shadow-2xl hover:border-[#333] transition-colors">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${detail.is_tool_call ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                                                            }`}>
                                                            {detail.agent_role || "System"}
                                                        </span>
                                                        <span className="text-slate-300 text-sm font-medium">{detail.task_description}</span>
                                                    </div>
                                                    <span className="text-xs font-mono text-slate-500">{format(new Date(detail.timestamp), "HH:mm:ss.SSS")}</span>
                                                </div>

                                                <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl p-4 overflow-hidden relative group">
                                                    {/* Copy Button Hover */}
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(detail.logs)}
                                                        className="absolute top-3 right-3 p-1.5 rounded-lg bg-[#262626] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                        </svg>
                                                    </button>

                                                    <pre className="whitespace-pre-wrap break-words text-[#4ade80] font-mono text-xs leading-relaxed max-w-[80vw]">
                                                        {formatLogOutput(detail.logs)}
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center font-mono text-sm text-slate-600 gap-4">
                        <Terminal size={48} className="opacity-20" />
                        Select an execution from the left to view traces
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper to slightly format stringified JSON if it's pure JSON
function formatLogOutput(logs: string) {
    if (!logs) return "No output payload.";
    try {
        const parsed = JSON.parse(logs);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return logs;
    }
}
