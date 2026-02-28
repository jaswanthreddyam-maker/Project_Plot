"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useUIStore, AgentConfig, TaskConfig } from "@/store/uiStore";
import { motion, AnimatePresence } from "framer-motion";

import KnowledgeManager from "./KnowledgeManager";

export default function AgentDashboard() {
    const {
        agentConfig, setAgentConfig,
        taskConfig, setTaskConfig,
        activeKnowledgeSources, // stub for now, will expand in Knowledge UI map
        selectedAgentId, setSelectedAgentId,
        selectedTaskId, setSelectedTaskId,
        activeProviders,
        isToolExecuting, setToolExecutionStart,
        toolTaskId, toolExecutionState, setToolExecutionState, setToolExecutionEnd,
        connectedIntegrations
    } = useUIStore();

    // ── Deployment State ─────────────────────────────────────
    const [isDeploying, setIsDeploying] = useState(false);
    const [terminalError, setTerminalError] = useState<string | null>(null);
    const [terminalChunks, setTerminalChunks] = useState<string[]>([]);

    // ── Scheduling State ──────────────────────────────────────
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleInterval, setScheduleInterval] = useState("Every Hour");
    const [isScheduling, setIsScheduling] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ── HITL State ───────────────────────────────────────────
    const [isInterventionRequired, setIsInterventionRequired] = useState(false);
    const [interventionPrompt, setInterventionPrompt] = useState("");
    const [interventionInput, setInterventionInput] = useState("");

    // Initial setup if empty
    useEffect(() => {
        if (agentConfig.length === 0) {
            const defaultAgent = { id: crypto.randomUUID(), role: "Senior Researcher", goal: "Uncover facts", backstory: "Expert analyst", provider: activeProviders[0] || "openai", tools: [] as string[] };
            setAgentConfig([defaultAgent]);
            setSelectedAgentId(defaultAgent.id);
        }
        if (taskConfig.length === 0) {
            const defaultTask = { id: crypto.randomUUID(), description: "Research the given topic", expected_output: "A detailed report", is_structured: false };
            setTaskConfig([defaultTask]);
            setSelectedTaskId(defaultTask.id);
        }
    }, [agentConfig.length, taskConfig.length, activeProviders, setAgentConfig, setTaskConfig, setSelectedAgentId, setSelectedTaskId]);

    // ── Handlers for Left Sidebar ────────────────────────────
    const addAgent = () => {
        const id = crypto.randomUUID();
        setAgentConfig([...agentConfig, { id, role: "New Agent", goal: "", backstory: "", provider: activeProviders[0] || "openai", tools: [] }]);
        setSelectedAgentId(id);
    };

    const addTask = () => {
        const id = crypto.randomUUID();
        setTaskConfig([...taskConfig, { id, description: "New Task", expected_output: "", is_structured: false }]);
        setSelectedTaskId(id);
    };

    // ── Selected Entities ──────────────────────────────────────
    const currentAgent = agentConfig.find(a => a.id === selectedAgentId) || agentConfig[0];
    const currentTask = taskConfig.find(t => t.id === selectedTaskId) || taskConfig[0];

    const updateAgent = (updates: Partial<AgentConfig>) => {
        if (!currentAgent) return;
        setAgentConfig(agentConfig.map(a => a.id === currentAgent.id ? { ...a, ...updates } : a));
    };

    const updateTask = (updates: Partial<TaskConfig>) => {
        if (!currentTask) return;
        setTaskConfig(taskConfig.map(t => t.id === currentTask.id ? { ...t, ...updates } : t));
    };

    // ── Deployment & SSE Terminal Logic ────────────────────────
    const handleReset = useCallback(() => {
        setToolExecutionEnd();
        setTerminalChunks([]);
        setTerminalError(null);
        if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    }, [setToolExecutionEnd]);

    useEffect(() => {
        if (!isToolExecuting || !toolTaskId) return;

        if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
        setTerminalError(null);
        setTerminalChunks([]);

        const eventSource = new EventSource(`http://localhost:8000/stream/${toolTaskId}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.event || data.type || data.status) {
                    case "status":
                        const stateMsg = data.data?.state || data.data || data.content || "Processing...";
                        if (stateMsg === "__INTERVENTION_REQUIRED__") {
                            setIsInterventionRequired(true);
                            setInterventionPrompt(data.data?.prompt || "Human intervention required to proceed.");
                        } else {
                            setToolExecutionState(stateMsg);
                        }
                        break;
                    case "chunk":
                        setTerminalChunks(prev => [...prev, data.data || data.content]);
                        break;
                    case "completed":
                        setToolExecutionState("Completed!");
                        resetTimeoutRef.current = setTimeout(handleReset, 4000);
                        eventSource.close();
                        break;
                    case "error":
                        setTerminalError(data.message || "Execution failed");
                        setToolExecutionState("Failed");
                        resetTimeoutRef.current = setTimeout(handleReset, 5000);
                        eventSource.close();
                        break;
                }
            } catch (err) {
                setTerminalChunks(prev => [...prev, event.data]);
            }
        };

        eventSource.onerror = () => {
            setTerminalError("Connection lost. Retrying...");
        };

        return () => {
            eventSource.close();
        };
    }, [isToolExecuting, toolTaskId, setToolExecutionState, handleReset]);

    const submitIntervention = async () => {
        if (!toolTaskId || !interventionInput.trim()) return;

        try {
            await fetch("http://localhost:8000/api/resume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ task_id: toolTaskId, feedback: interventionInput })
            });
            setIsInterventionRequired(false);
            setInterventionInput("");
            setToolExecutionState("Resuming execution with feedback...");
        } catch (err) {
            console.error("Failed to submit feedback", err);
        }
    };

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [terminalChunks, toolExecutionState]);

    const deployCrew = async () => {
        if (isDeploying || isToolExecuting) return;
        setIsDeploying(true);
        setTerminalError(null);

        const payload = {
            tool_name: "PlotAutonomous",
            arguments: {
                objective: "Custom User Workflow", // In a real system, overall objective is passed too
                agents: agentConfig,
                tasks: taskConfig,
                knowledge_sources: activeKnowledgeSources
            }
        };

        try {
            const res = await fetch("http://localhost:8000/api/tools/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                const data = await res.json();
                setToolExecutionStart(data.task_id, data.execution_id || data.task_id);
            } else {
                let errText = "Failed to deploy Crew. Check backend connection.";
                try {
                    const errObj = await res.json();
                    errText = errObj.detail || errText;
                } catch (e) {
                    errText = await res.text() || errText;
                }
                setTerminalError(`Deployment Failed: ${errText}`);
                console.error("Backend Error:", errText);
            }
        } catch (err: any) {
            setTerminalError(`Network Error: ${err.message || "Failed to reach backend."}`);
        } finally {
            setIsDeploying(false);
        }
    };

    const scheduleFlow = async () => {
        setIsScheduling(true);
        try {
            const payload = {
                objective: "Scheduled Plot workflow",
                knowledge_sources: activeKnowledgeSources,
                agents: agentConfig,
                tasks: taskConfig
            };
            const res = await fetch("http://localhost:8000/api/tools/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ interval: scheduleInterval, arguments: payload })
            });
            if (res.ok) {
                setShowScheduleModal(false);
                alert(`Successfully scheduled for: ${scheduleInterval}`);
            } else {
                alert("Failed to schedule workflow.");
            }
        } catch (e) {
            console.error(e);
            alert("Error scheduling workflow.");
        } finally {
            setIsScheduling(false);
        }
    };

    return (
        <div className="flex h-full w-full bg-slate-50 dark:bg-[#171717] overflow-hidden relative">


            {/* ── Center Canvas (Forms) ── */}
            <div className="flex-1 flex flex-col h-full overflow-y-auto">
                <div className="p-6 md:p-8 max-w-5xl mx-auto w-full pb-32">

                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Agent Editor</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Configure your autonomous agents and tasks</p>
                        </div>
                        <div className="flex items-center gap-3 relative">
                            <button
                                onClick={() => setShowScheduleModal(!showScheduleModal)}
                                disabled={isDeploying || isToolExecuting || isScheduling}
                                className="px-5 py-2.5 rounded-full font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm"
                            >
                                ⏱️ Schedule
                            </button>
                            <button
                                onClick={deployCrew}
                                disabled={isDeploying || isToolExecuting}
                                className="px-6 py-2.5 rounded-full font-semibold text-white bg-black hover:bg-gray-900 disabled:opacity-50 transition-all shadow-md shadow-black/20 flex items-center gap-2"
                            >
                                {isDeploying || isToolExecuting ? (
                                    <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Deploying...</>
                                ) : "Deploy Plot"}
                            </button>

                            {/* Schedule Popover */}
                            <AnimatePresence>
                                {showScheduleModal && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute top-14 right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
                                    >
                                        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Schedule Automation</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Run this workflow automatically at the selected interval.</p>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            <select
                                                value={scheduleInterval}
                                                onChange={(e) => setScheduleInterval(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                            >
                                                <option value="Every 1 Minute">Every 1 Minute (Testing)</option>
                                                <option value="Every Hour">Every Hour</option>
                                                <option value="Daily at 9 AM">Daily at 9 AM</option>
                                                <option value="Weekly (Monday)">Weekly (Monday)</option>
                                            </select>
                                            <button
                                                onClick={scheduleFlow}
                                                disabled={isScheduling}
                                                className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                                            >
                                                {isScheduling ? "Saving..." : "Confirm Schedule"}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Inline Error Alert */}
                    <AnimatePresence>
                        {terminalError && !isToolExecuting && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl"
                            >
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <h4 className="text-sm font-bold text-red-800 dark:text-red-400">Deployment Failed</h4>
                                        <p className="text-xs text-red-600 dark:text-red-300 mt-1 break-words font-mono">
                                            {terminalError}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
                        {/* Agent Form */}
                        {currentAgent && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center justify-between">
                                    Agent Configuration
                                </h3>

                                <div className="space-y-4">
                                    <div className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-xs font-semibold rounded-lg flex items-center gap-2 border border-indigo-100 dark:border-indigo-800/50">
                                        <span>🧠</span> Long-Term Memory (Active)
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
                                        <input
                                            value={currentAgent.role}
                                            onChange={(e) => updateAgent({ role: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Goal</label>
                                        <textarea
                                            value={currentAgent.goal}
                                            onChange={(e) => updateAgent({ goal: e.target.value })}
                                            rows={2}
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Backstory</label>
                                        <textarea
                                            value={currentAgent.backstory}
                                            onChange={(e) => updateAgent({ backstory: e.target.value })}
                                            rows={3}
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">LLM Provider</label>
                                        <select
                                            value={currentAgent.provider}
                                            onChange={(e) => updateAgent({ provider: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                        >
                                            {activeProviders.map((p) => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {/* Assigned Tools */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-2">Assigned Tools</label>
                                        <div className="space-y-2">
                                            {[
                                                { id: "Web Search", name: "Web Search", provider: "SerperDev", integration: null },
                                                { id: "Web Scraper", name: "Web Scraper", provider: "ScrapeWebsite", integration: null },
                                                { id: "GitHub", name: "GitHub", provider: "crewai_tools", integration: "github" },
                                                { id: "Asana", name: "Asana", provider: "crewai_tools", integration: "asana" },
                                                { id: "Jira", name: "Jira", provider: "crewai_tools", integration: "jira" }
                                            ].map((tool) => {
                                                const isChecked = (currentAgent.tools || []).includes(tool.id);

                                                // Lock check
                                                const requiresAuth = tool.integration !== null;
                                                const isAuthorized = requiresAuth ? connectedIntegrations.includes(tool.integration as string) : true;
                                                const isLocked = requiresAuth && !isAuthorized;

                                                return (
                                                    <label
                                                        key={tool.id}
                                                        title={isLocked ? `Connect ${tool.name} in Tools & Integrations to use this tool.` : ""}
                                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors
                                                            ${isLocked
                                                                ? "border-slate-100 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/20 cursor-not-allowed opacity-60"
                                                                : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700"
                                                            }
                                                        `}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked && !isLocked}
                                                            disabled={isLocked}
                                                            onChange={() => {
                                                                if (isLocked) return;
                                                                const tools = currentAgent.tools || [];
                                                                updateAgent({
                                                                    tools: isChecked
                                                                        ? tools.filter((t) => t !== tool.id)
                                                                        : [...tools, tool.id],
                                                                });
                                                            }}
                                                            className={`w-4 h-4 rounded focus:ring-indigo-500 border-slate-300 dark:border-slate-600
                                                                ${isLocked ? "text-slate-300 dark:text-slate-600 cursor-not-allowed" : "text-indigo-500"}
                                                            `}
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm">
                                                                {tool.name === "Web Search" ? "🔍" :
                                                                    tool.name === "Web Scraper" ? "🌐" :
                                                                        tool.name === "GitHub" ? "🐙" :
                                                                            tool.name === "Asana" ? "🏗️" :
                                                                                tool.name === "Jira" ? "📝" : "🔧"}
                                                            </span>
                                                            <span className={`text-sm font-medium ${isLocked ? "text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-300"}`}>
                                                                {tool.name}
                                                            </span>
                                                            {isLocked && (
                                                                <span className="text-sm ml-1 select-none" title="Locked">
                                                                    🔒
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="ml-auto text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                            {tool.provider}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Task Form */}
                        {currentTask && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Task Configuration</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                                        <textarea
                                            value={currentTask.description}
                                            onChange={(e) => updateTask({ description: e.target.value })}
                                            rows={3}
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Expected Output</label>
                                        <textarea
                                            value={currentTask.expected_output}
                                            onChange={(e) => updateTask({ expected_output: e.target.value })}
                                            rows={3}
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white resize-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3 mt-4">
                                        <input
                                            type="checkbox"
                                            id="structured-toggle"
                                            checked={currentTask.is_structured}
                                            onChange={(e) => updateTask({ is_structured: e.target.checked })}
                                            className="w-4 h-4 text-indigo-500 rounded focus:ring-indigo-500 border-slate-300"
                                        />
                                        <label htmlFor="structured-toggle" className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                                            Require Structured Output (JSON/Pydantic)
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <KnowledgeManager />

                </div>
            </div>

            {/* ── Bottom Terminal Overlay ── */}
            <AnimatePresence>
                {isToolExecuting && (
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="absolute bottom-0 left-0 right-0 h-80 z-40 p-4 pointer-events-none" // pointer-events-none so we can click around it, but inner div will have pointer-events-auto
                    >
                        <div className="max-w-4xl mx-auto h-full rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] bg-slate-900/80 backdrop-blur-md border border-slate-700/50 flex flex-col overflow-hidden pointer-events-auto">

                            {/* Terminal Header */}
                            <div className="px-4 py-2 border-b border-slate-700/50 flex items-center justify-between bg-black/20">
                                <div className="flex items-center gap-3">
                                    <span className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                        <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                                        <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                                    </span>
                                    <span className="text-xs font-mono text-emerald-400 font-medium">
                                        {toolExecutionState || "Listening for events..."}
                                    </span>
                                </div>
                                <button onClick={handleReset} className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition">
                                    Close
                                </button>
                            </div>

                            {/* Terminal Log */}
                            <div className="flex-1 p-4 overflow-y-auto font-mono text-sm space-y-2 scrollbar-thin scrollbar-thumb-slate-600">
                                <AnimatePresence initial={false}>
                                    {terminalChunks.map((chunk, i) => (
                                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-slate-300 break-words flex gap-3">
                                            <span className="text-indigo-400 shrink-0">❯</span>
                                            <span>{chunk}</span>
                                        </motion.div>
                                    ))}
                                    {terminalError && (
                                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-red-400 break-words italic">
                                            ✖ {terminalError}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <div ref={bottomRef} className="h-4" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── HITL Intervention Modal ── */}
            <AnimatePresence>
                {isInterventionRequired && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-lg w-full"
                        >
                            <div className="flex items-center gap-3 mb-4 text-amber-500">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Human Intervention Required</h3>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                {interventionPrompt}
                            </p>
                            <textarea
                                value={interventionInput}
                                onChange={(e) => setInterventionInput(e.target.value)}
                                placeholder="Enter your instructions or guidance..."
                                rows={4}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white resize-none mb-4"
                                autoFocus
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={submitIntervention}
                                    disabled={!interventionInput.trim()}
                                    className="px-5 py-2 rounded-lg font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    Submit Feedback
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}
