"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useUIStore, AgentConfig, TaskConfig } from "@/store/uiStore";
import { API_BASE } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Brain, Calendar, User, Wrench, Play, ArrowRightLeft, Repeat, UserCheck } from "lucide-react";
import { ApprovalOverlay } from "./ApprovalOverlay";

import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    NodeChange,
    EdgeChange,
    Node,
    Edge,
    Handle,
    Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import KnowledgeManager from "./KnowledgeManager";

// --- Custom Nodes ---

const AgentNode = ({ data }: { data: { label: string, onClick: () => void, isSelected?: boolean, isThinking?: boolean } }) => (
    <motion.div
        onClick={data.onClick}
        animate={data.isThinking ? {
            boxShadow: ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 15px rgba(0,0,0,0.2)", "0px 0px 0px rgba(0,0,0,0)"],
            borderColor: ["#e2e8f0", "#94a3b8", "#e2e8f0"]
        } : {}}
        transition={data.isThinking ? { duration: 2, repeat: Infinity } : {}}
        className={`w-64 bg-white dark:bg-black border-2 rounded-2xl p-4 shadow-sm transition-all cursor-pointer hover:shadow-md outline-none ring-0 ${data.isSelected
            ? "border-black dark:border-white shadow-lg"
            : "border-slate-200 dark:border-slate-800 hover:border-black dark:hover:border-white"
            }`}
    >
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-black dark:bg-white border-none" />
        <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${data.isThinking ? "bg-black text-white dark:bg-white dark:text-black" : "bg-slate-50 dark:bg-slate-900"}`}>
                <User size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-black dark:text-white truncate">{data.label}</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Autonomous Agent</p>
                {data.isThinking && (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[10px] font-bold text-black dark:text-white mt-1 block tracking-tighter"
                    >
                        THINKING...
                    </motion.span>
                )}
            </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-black dark:bg-white border-none" />
    </motion.div>
);

const ToolNode = ({ data }: { data: { label: string, provider: string, isActive?: boolean } }) => (
    <motion.div
        animate={data.isActive ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.5, repeat: data.isActive ? Infinity : 0 }}
        className={`bg-white dark:bg-black border rounded-full px-4 py-2 flex items-center gap-3 shadow-sm min-w-32 outline-none ring-0 ${data.isActive ? "border-black dark:border-white" : "border-slate-200 dark:border-slate-800"}`}
    >
        <Handle type="target" position={Position.Top} className="!bg-slate-400" />
        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0">
            <Wrench size={12} className="text-slate-600 dark:text-slate-400" />
        </div>
        <div>
            <span className="text-xs font-bold text-black dark:text-white block whitespace-nowrap">{data.label}</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest">{data.provider}</span>
        </div>
        <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </motion.div>
);

const nodeTypes = {
    agent: AgentNode,
    tool: ToolNode
};

export default function CrewStudio() {
    const {
        agentConfig, setAgentConfig,
        taskConfig, setTaskConfig,
        activeKnowledgeSources,
        selectedAgentId, setSelectedAgentId,
        selectedTaskId, setSelectedTaskId,
        activeProviders,
        isToolExecuting, setToolExecutionStart,
        toolTaskId, toolExecutionState, setToolExecutionState, setToolExecutionEnd,
        connectedIntegrations
    } = useUIStore();

    // ── Deployment State ───────────────────────────────────────
    const [isDeploying, setIsDeploying] = useState(false);
    const [terminalError, setTerminalError] = useState<string | null>(null);
    const [terminalChunks, setTerminalChunks] = useState<string[]>([]);

    // ── Scheduling State ─────────────────────────────────────────
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleInterval, setScheduleInterval] = useState("Every Hour");
    const [isScheduling, setIsScheduling] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ── HITL State ───────────────────────────────────────────────
    const [isInterventionRequired, setIsInterventionRequired] = useState(false);
    const [interventionPrompt, setInterventionPrompt] = useState("");
    const [interventionInput, setInterventionInput] = useState("");

    // ── HITL Approval State ──────────────────────────────────────
    const [isApprovalOpen, setIsApprovalOpen] = useState(false);
    const [approvalToolName, setApprovalToolName] = useState("");
    const [approvalArguments, setApprovalArguments] = useState<any>(null);
    const [approvalExecutionId, setApprovalExecutionId] = useState("");

    // ── React Flow State ─────────────────────────────────────────
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // ── Visual Trace Sync ──────────────────────────────────────
    const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
    const [activeToolId, setActiveToolId] = useState<string | null>(null);
    const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);

    // ── Execution Output Modal ─────────────────────────────────
    const [showOutputModal, setShowOutputModal] = useState(false);
    const [outputData, setOutputData] = useState<string | null>(null);
    const [isOutputLoading, setIsOutputLoading] = useState(false);

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

    // Sync React Flow nodes with AgentConfig
    useEffect(() => {
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        let yOffset = 50;

        agentConfig.forEach((agent, index) => {
            const nodeId = `agent-${agent.id}`;
            newNodes.push({
                id: nodeId,
                type: 'agent',
                position: { x: 250, y: yOffset },
                data: {
                    label: agent.role || "Untitled Agent",
                    isSelected: selectedAgentId === agent.id,
                    isThinking: activeAgentId === agent.id,
                    onClick: () => {
                        setSelectedAgentId(agent.id);
                        setIsDrawerOpen(true);
                    }
                },
            });

            // If not first agent, connect to previous (delegation path)
            if (index > 0) {
                const edgeId = `edge-${agentConfig[index - 1].id}-${agent.id}`;
                newEdges.push({
                    id: edgeId,
                    source: `agent-${agentConfig[index - 1].id}`,
                    target: nodeId,
                    type: 'smoothstep',
                    animated: activeEdgeId === edgeId,
                    style: {
                        stroke: activeEdgeId === edgeId ? '#000' : '#e2e8f0',
                        strokeWidth: activeEdgeId === edgeId ? 3 : 2
                    }
                });
            }

            // Lay out generic tools attached to this agent
            if (agent.tools && agent.tools.length > 0) {
                agent.tools.forEach((tool, tIdx) => {
                    const toolNodeId = `tool-${agent.id}-${tool}`;
                    const toolActive = activeToolId === toolNodeId;
                    const toolEdgeId = `edge-${nodeId}-${toolNodeId}`;
                    newNodes.push({
                        id: toolNodeId,
                        type: 'tool',
                        position: { x: 600, y: yOffset + (tIdx * 80) },
                        data: {
                            label: tool,
                            provider: "integration",
                            isActive: toolActive
                        }
                    });

                    newEdges.push({
                        id: toolEdgeId,
                        source: nodeId,
                        target: toolNodeId,
                        type: 'smoothstep',
                        animated: toolActive || activeEdgeId === toolEdgeId,
                        style: {
                            stroke: (toolActive || activeEdgeId === toolEdgeId) ? '#000' : '#94a3b8',
                            strokeWidth: (toolActive || activeEdgeId === toolEdgeId) ? 2 : 1.5,
                            strokeDasharray: '4 4'
                        }
                    });
                });
            }

            yOffset += Math.max(200, (agent.tools?.length || 0) * 80);
        });

        setNodes(newNodes);
        setEdges(newEdges);
    }, [agentConfig, selectedAgentId, activeAgentId, activeToolId, activeEdgeId]);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    // ── Selected Entities ─────────────────────────────────────────
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

    // ── Deployment & SSE Terminal Logic ─────────────────────────
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

        // USE THE NEW TRACES SSE ENDPOINT
        const eventSource = new EventSource(`${API_BASE}/api/traces/stream/${toolTaskId}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.type || data.status) {
                    case "thought":
                        // Activate the agent "Thinking" state
                        // For now we use the first agent as default if no specific ID in trace
                        setActiveAgentId(agentConfig[0]?.id || null);
                        setTerminalChunks(prev => [...prev, data.content]);

                        // Clear active states after a delay if no new events
                        setTimeout(() => {
                            setActiveAgentId(null);
                            setActiveToolId(null);
                            setActiveEdgeId(null);
                        }, 3000);
                        break;
                    case "tool":
                        // Activate tool node and edge
                        const toolNodeId = `tool-${agentConfig[0]?.id}-${data.name}`;
                        setActiveToolId(toolNodeId);
                        setActiveEdgeId(`edge-agent-${agentConfig[0]?.id}-${toolNodeId}`);
                        setTerminalChunks(prev => [...prev, `Using tool: ${data.name} with input: ${data.input}`]);

                        setTimeout(() => {
                            setActiveToolId(null);
                            setActiveEdgeId(null);
                        }, 3000);
                        break;
                    case "status":
                        const stateMsg = data.content || "Processing...";
                        if (stateMsg === "__INTERVENTION_REQUIRED__") {
                            setIsInterventionRequired(true);
                            setInterventionPrompt(data.prompt || "Human intervention required to proceed.");
                        } else {
                            setToolExecutionState(stateMsg);
                        }
                        break;
                    case "chunk":
                        setTerminalChunks(prev => [...prev, data.content]);
                        break;
                    case "approval_required":
                        setApprovalToolName(data.tool_name);
                        setApprovalArguments(data.arguments);
                        setApprovalExecutionId(data.execution_id || toolTaskId);
                        setIsApprovalOpen(true);
                        setToolExecutionState("Waiting for Approval...");
                        break;
                    case "completed":
                        setToolExecutionState("Completed!");
                        setActiveAgentId(null);
                        setActiveToolId(null);
                        setActiveEdgeId(null);
                        // Mark all tasks as completed
                        setTaskConfig(useUIStore.getState().taskConfig.map(t => ({ ...t, status: 'Completed' as const })));
                        // Capture real result from backend
                        if (data.result) {
                            setOutputData(data.result);
                            setIsOutputLoading(false);
                            setShowOutputModal(true);
                        }
                        resetTimeoutRef.current = setTimeout(handleReset, 4000);
                        eventSource.close();
                        break;
                    case "error":
                        setTerminalError(data.content || "Execution failed");
                        setToolExecutionState("Failed");
                        setActiveAgentId(null);
                        setActiveToolId(null);
                        setActiveEdgeId(null);
                        resetTimeoutRef.current = setTimeout(handleReset, 5000);
                        eventSource.close();
                        break;
                }
            } catch (err) {
                console.error("SSE Parse Error", err);
            }
        };

        eventSource.onerror = () => {
            setTerminalError("Connection lost. Retrying...");
        };

        return () => {
            eventSource.close();
        };
    }, [isToolExecuting, toolTaskId, setToolExecutionState, handleReset, agentConfig]);

    const handleApprove = async () => {
        if (!approvalExecutionId) return;
        try {
            await fetch(`${API_BASE}/api/approval/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ execution_id: approvalExecutionId })
            });
            setIsApprovalOpen(false);
            setToolExecutionState("Approval granted. Resuming...");
        } catch (err) {
            console.error("Failed to approve", err);
        }
    };

    const handleDeny = async () => {
        if (!approvalExecutionId) return;
        try {
            await fetch(`${API_BASE}/api/approval/deny`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ execution_id: approvalExecutionId })
            });
            setIsApprovalOpen(false);
            setToolExecutionState("Action denied. Halted.");
        } catch (err) {
            console.error("Failed to deny", err);
        }
    };

    const submitIntervention = async () => {
        if (!toolTaskId || !interventionInput.trim()) return;

        try {
            await fetch(`${API_BASE}/api/resume`, {
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
        if (bottomRef.current && !isApprovalOpen) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [terminalChunks, toolExecutionState, isApprovalOpen]);

    const runPlot = async () => {
        if (isDeploying || isToolExecuting) return;
        if (taskConfig.length === 0) {
            setTerminalError("No tasks to run.");
            return;
        }

        setIsDeploying(true);
        setTerminalError(null);
        setTerminalChunks([]);
        setOutputData(null);
        setIsOutputLoading(true);
        setShowOutputModal(true);

        // Mark all tasks as Running
        setTaskConfig(taskConfig.map(t => ({ ...t, status: 'Running' as const })));

        const payload = {
            tool_name: "PlotAutonomous",
            arguments: {
                objective: "Custom User Workflow",
                agents: agentConfig,
                tasks: taskConfig,
                knowledge_sources: activeKnowledgeSources
            }
        };

        try {
            const res = await fetch(`${API_BASE}/api/tools/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                const data = await res.json();
                // This triggers the SSE useEffect which handles real-time traces and the completed event
                setToolExecutionStart(data.task_id, data.execution_id || data.task_id);
            } else {
                let errText = "Failed to deploy Crew. Check backend connection.";
                try {
                    const errObj = await res.json();
                    errText = errObj.detail || errText;
                } catch (e) {
                    errText = await res.text() || errText;
                }
                setTerminalError(`Execution Failed: ${errText}`);
                setIsOutputLoading(false);
                setShowOutputModal(false);
                setTaskConfig(useUIStore.getState().taskConfig.map(t => ({ ...t, status: 'Failed' as const })));
            }
        } catch (err: any) {
            setTerminalError(`Network Error: ${err.message || "Failed to reach backend."}`);
            setIsOutputLoading(false);
            setShowOutputModal(false);
            setTaskConfig(useUIStore.getState().taskConfig.map(t => ({ ...t, status: 'Failed' as const })));
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
            const res = await fetch(`${API_BASE}/api/tools/schedule`, {
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
        <div className="flex h-full w-full bg-slate-50 dark:bg-[#171717] overflow-hidden relative autonomous-theme">

            {/* ── React Flow Canvas ── */}
            <div className="flex-1 w-full h-full relative">

                {/* Flow Header Overlays */}
                <div className="absolute top-6 left-6 right-6 z-10 flex items-center justify-between pointer-events-none">
                    <div className="pointer-events-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Plot Studio</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Map out agents and their tools organically.</p>
                    </div>

                    <div className="flex items-center gap-3 relative pointer-events-auto">
                        <button
                            onClick={() => setShowScheduleModal(!showScheduleModal)}
                            disabled={isDeploying || isToolExecuting || isScheduling}
                            className="px-5 py-2.5 rounded-full font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm"
                        >
                            <Calendar size={16} /> Schedule
                        </button>
                        <button
                            onClick={runPlot}
                            disabled={isDeploying || isToolExecuting}
                            className="px-6 py-2.5 rounded-full font-semibold text-white bg-black dark:bg-white dark:text-black disabled:opacity-50 transition-all shadow-md flex items-center gap-2"
                        >
                            {isDeploying || isToolExecuting ? (
                                <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-inherit border-t-transparent rounded-full" /> Running...</>
                            ) : (
                                <><Play size={16} className="fill-current" /> Run Plot</>
                            )}
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

                <div className="absolute top-24 left-6 right-6 z-10 pointer-events-auto">
                    {/* Inline Error Alert */}
                    <AnimatePresence>
                        {terminalError && !isToolExecuting && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl max-w-lg shadow-sm"
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
                </div>

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    className="w-full h-full outline-none ring-0"
                    onPaneClick={() => setIsDrawerOpen(false)}
                >
                    <Background color="#000" gap={16} size={0.5} style={{ opacity: 0.1 }} />
                </ReactFlow>

            </div>

            {/* ── Slide-over Editor Drawer ── */}
            <AnimatePresence>
                {isDrawerOpen && currentAgent && (
                    <motion.div
                        initial={{ x: "100%", opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="absolute top-4 bottom-4 right-4 w-96 bg-white dark:bg-black rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col z-20"
                    >
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-black">
                            <h3 className="font-bold text-black dark:text-white flex items-center gap-2">
                                <User size={18} /> Map Properties
                            </h3>
                            <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-black dark:hover:text-white p-1">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">

                            {/* Agent Form */}
                            <div>
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Agent Node</h4>
                                <div className="space-y-4">
                                    <div className="px-3 py-2 bg-black text-white dark:bg-white dark:text-black text-xs font-semibold rounded-lg flex items-center gap-2 border border-black dark:border-white">
                                        <Brain size={14} /> Long-Term Memory (Active)
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
                                        <input
                                            key={currentAgent.id}
                                            autoFocus
                                            onFocus={(e) => e.target.select()}
                                            value={currentAgent.role}
                                            onChange={(e) => updateAgent({ role: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-sm focus:outline-none ring-0 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Goal</label>
                                        <textarea
                                            value={currentAgent.goal}
                                            onChange={(e) => updateAgent({ goal: e.target.value })}
                                            rows={2}
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-sm focus:outline-none ring-0 dark:text-white resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Backstory</label>
                                        <textarea
                                            value={currentAgent.backstory}
                                            onChange={(e) => updateAgent({ backstory: e.target.value })}
                                            rows={3}
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-sm focus:outline-none ring-0 dark:text-white resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">LLM Provider</label>
                                        <select
                                            value={currentAgent.provider}
                                            onChange={(e) => updateAgent({ provider: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-sm focus:outline-none ring-0 dark:text-white"
                                        >
                                            {activeProviders.map((p) => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Assigned Tools */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-2">Connected Tools</label>
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
                                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors
                                                            ${isLocked
                                                                ? "border-slate-100 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/20 cursor-not-allowed opacity-60"
                                                                : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 cursor-pointer hover:border-black dark:hover:border-white"
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
                                                            className={`w-4 h-4 rounded focus:ring-black border-slate-300 dark:border-slate-600 outline-none ring-0
                                                                ${isLocked ? "text-slate-300 dark:text-slate-600 cursor-not-allowed" : "text-black dark:text-white"}
                                                            `}
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <Wrench size={14} className={isLocked ? "text-slate-400" : "text-black dark:text-white"} />
                                                            <span className={`text-sm font-medium ${isLocked ? "text-slate-400 dark:text-slate-500" : "text-black dark:text-white"}`}>
                                                                {tool.name}
                                                            </span>
                                                            {isLocked && (
                                                                <span className="text-sm ml-1 select-none" title="Locked">
                                                                    <Lock size={12} className="text-slate-400" />
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

                            {/* Task Form */}
                            {currentTask && (
                                <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 pt-4 border-t border-slate-100 dark:border-slate-800">Task Node</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                                            <textarea
                                                value={currentTask.description}
                                                onChange={(e) => updateTask({ description: e.target.value })}
                                                rows={3}
                                                className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-sm focus:outline-none ring-0 dark:text-white resize-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Expected Output</label>
                                            <textarea
                                                value={currentTask.expected_output}
                                                onChange={(e) => updateTask({ expected_output: e.target.value })}
                                                rows={3}
                                                className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-sm focus:outline-none ring-0 dark:text-white resize-none"
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 mt-4">
                                            <input
                                                type="checkbox"
                                                id="structured-toggle"
                                                checked={currentTask.is_structured}
                                                onChange={(e) => updateTask({ is_structured: e.target.checked })}
                                                className="w-4 h-4 text-black bg-white dark:bg-black border-slate-300 rounded outline-none ring-0 focus:ring-black"
                                            />
                                            <label htmlFor="structured-toggle" className="text-sm text-black dark:text-white font-medium select-none">
                                                Require Structured Output
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>


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
                        <div className="max-w-4xl mx-auto h-full rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] bg-white dark:bg-black border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden pointer-events-auto">

                            {/* Terminal Header */}
                            <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-black">
                                <div className="flex items-center gap-3">
                                    <span className="flex gap-1.5 grayscale">
                                        <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                                        <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                                        <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                                    </span>
                                    <span className="text-xs font-mono text-black dark:text-white font-medium">
                                        {toolExecutionState || "Listening for events..."}
                                    </span>
                                </div>
                                <button onClick={handleReset} className="text-slate-500 hover:text-black dark:hover:text-white text-xs font-semibold px-2 py-1 rounded border border-slate-200 dark:border-slate-800 transition">
                                    Close
                                </button>
                            </div>

                            {/* Terminal Log */}
                            <div className={`flex-1 p-4 overflow-y-auto font-mono text-sm space-y-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 transition-all duration-300 ${isApprovalOpen ? "grayscale-[0.5] blur-sm pointer-events-none" : ""}`}>
                                <AnimatePresence initial={false}>
                                    {terminalChunks.map((chunk, i) => (
                                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-black dark:text-white break-words flex gap-3">
                                            <span className="text-slate-400 shrink-0">❯</span>
                                            <span>{chunk}</span>
                                        </motion.div>
                                    ))}
                                    {terminalError && (
                                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-black dark:text-white font-bold break-words underline decoration-red-500/50">
                                            ERROR: {terminalError}
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
                        className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-white/20 dark:bg-black/20 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-black border border-black dark:border-white rounded-2xl shadow-2xl p-6 max-w-lg w-full"
                        >
                            <div className="flex items-center gap-3 mb-4 text-black dark:text-white">
                                <Repeat size={24} />
                                <h3 className="text-lg font-bold">Human Intervention Required</h3>
                            </div>
                            <p className="text-sm text-black dark:text-white mb-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                {interventionPrompt}
                            </p>
                            <textarea
                                value={interventionInput}
                                onChange={(e) => setInterventionInput(e.target.value)}
                                placeholder="Enter your instructions or guidance..."
                                rows={4}
                                className="w-full bg-white dark:bg-black border border-black dark:border-white rounded-xl px-4 py-3 text-sm focus:outline-none ring-0 dark:text-white resize-none mb-4"
                                autoFocus
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={submitIntervention}
                                    disabled={!interventionInput.trim()}
                                    className="px-5 py-2 rounded-lg font-semibold text-white bg-black dark:bg-white dark:text-black disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    <ArrowRightLeft size={16} /> Submit Feedback
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── HITL Approval Overlay ── */}
            <ApprovalOverlay
                isOpen={isApprovalOpen}
                executionId={approvalExecutionId}
                toolName={approvalToolName}
                arguments={approvalArguments}
                onApprove={handleApprove}
                onDeny={handleDeny}
            />

            {/* ── Output Data Modal ── */}
            <AnimatePresence>
                {showOutputModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center p-4 bg-white/40 dark:bg-black/40 backdrop-blur-md justify-center"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                                <h3 className="text-xl font-bold flex items-center gap-2 text-black dark:text-white">
                                    <UserCheck size={24} className="text-emerald-500" />
                                    Plot Execution Output
                                </h3>
                                <button onClick={() => setShowOutputModal(false)} className="text-slate-400 hover:text-black dark:hover:text-white transition-colors">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-mono p-4 bg-slate-50 dark:bg-black rounded-xl border border-slate-100 dark:border-slate-900 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                                {isOutputLoading ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                            className="w-10 h-10 border-3 border-slate-300 dark:border-slate-700 border-t-black dark:border-t-white rounded-full"
                                        />
                                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 tracking-tight">Processing... Agents are working.</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">Real-time traces are streaming below.</p>
                                    </div>
                                ) : outputData ? (
                                    outputData
                                ) : (
                                    <p className="text-slate-400 dark:text-slate-500 text-center py-8">No output data received.</p>
                                )}
                            </div>
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={() => setShowOutputModal(false)}
                                    className="px-6 py-2.5 rounded-xl font-bold text-white bg-black dark:bg-white dark:text-black transition-transform hover:scale-105"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}
