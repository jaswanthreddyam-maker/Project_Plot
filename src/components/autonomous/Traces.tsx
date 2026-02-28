"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";

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
                    setTraceDetails(data);
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
        <div className="flex h-full bg-[#171717] overflow-hidden">
            {/* Left Pane - Executions List */}
            <div className="w-1/3 min-w-[300px] border-r border-[#262626] bg-[#1a1a1a] flex flex-col h-full">
                <div className="p-4 border-b border-[#262626] flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-200">Execution Traces</h2>
                    <button
                        onClick={fetchRuns}
                        className="p-1 hover:bg-[#262626] rounded text-slate-400"
                        title="Refresh Runs"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-sm text-slate-500 text-center animate-pulse">Loading executions...</div>
                    ) : runs.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500 text-center pt-8">No traces found yet. Run an autonomous workflow first.</div>
                    ) : (
                        <div className="divide-y divide-[#262626]">
                            {runs.map((run) => (
                                <button
                                    key={run.execution_id}
                                    onClick={() => setSelectedRun(run.execution_id)}
                                    className={`w-full text-left p-4 hover:bg-[#262626] transition-colors ${selectedRun === run.execution_id ? "bg-[#262626] border-l-2 border-indigo-500" : "border-l-2 border-transparent"}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-mono text-slate-300 truncate pr-2">
                                            {run.execution_id.split("-").pop()}
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${run.status.toLowerCase() === 'running' ? 'bg-blue-500/10 text-blue-400' :
                                            run.status.toLowerCase() === 'failed' ? 'bg-red-500/10 text-red-400' :
                                                'bg-emerald-500/10 text-emerald-400'
                                            }`}>
                                            {run.status}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                        {format(new Date(run.timestamp), "MMM d, HH:mm:ss")}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Pane - Strict Terminal Viewer */}
            <div className="flex-1 flex flex-col h-full bg-black relative">
                {selectedRun ? (
                    <>
                        <div className="px-4 py-2 border-b border-[#262626] bg-[#121212] flex justify-between items-center shrink-0">
                            <h3 className="text-xs font-mono text-slate-400">
                                root@plot-autonomous:~# logs {selectedRun.split("-").pop()}
                            </h3>
                            {loadingDetails && <span className="text-[10px] text-emerald-500 animate-pulse font-mono">syncing...</span>}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-green-400 leading-relaxed font-secondary">
                            {traceDetails.length === 0 && !loadingDetails ? (
                                <p className="text-slate-600">No logs generated for this execution yet.</p>
                            ) : (
                                <div className="space-y-6">
                                    {traceDetails.map((detail, idx) => (
                                        <div key={detail.id} className="border-l border-green-900/50 pl-4 py-1">
                                            <div className="flex items-center gap-2 mb-2 text-green-600">
                                                <span>[{format(new Date(detail.timestamp), "HH:mm:ss.SSS")}]</span>
                                                <span className="font-bold text-green-300">{detail.agent_role || "System"}</span>
                                                <span>-&gt;</span>
                                                <span className="text-green-500">{detail.task_description}</span>
                                            </div>
                                            <pre className="whitespace-pre-wrap break-words text-green-400 font-secondary mt-1 max-w-[80vw]">
                                                {formatLogOutput(detail.logs)}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center font-mono text-sm text-slate-600">
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
