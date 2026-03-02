"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    addEdge,
    Connection,
    Edge,
    Handle,
    Node,
    NodeProps,
    Position,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
    useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
    Bell,
    ChevronDown,
    ChevronUp,
    Loader2,
    Mic,
    Paperclip,
    Play,
    Save,
    Search,
    SendHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
    TOOLBOX_NODE_DATA_MIME,
    TOOLBOX_NODE_TYPE_MIME,
} from "@/components/PlotStudio/Toolbox";
import FlowCanvas from "@/components/PlotStudio/FlowCanvas";
import Toolbox from "@/components/PlotStudio/Toolbox";
import { API_BASE, fetchWithTimeout, readErrorMessage } from "@/lib/api";
import { showToast } from "@/lib/toast";
import type {
    ExecuteFlowRequestPayload,
    ExecuteFlowResponsePayload,
    ExecuteFlowStreamEvent,
    FlowExecutionLog,
    FlowNodeData,
    ProjectDto,
    ProjectGraphDto,
    ProjectUpdatePayload,
    ToolData,
} from "@/types/api";

interface PlotStudioEditorProps {
    projectId?: string;
}

type StudioTab = "visual" | "execution";

type PlotFlowNode = Node<FlowNodeData, "plotNode">;

function parseSseEvent(rawEvent: string): ExecuteFlowStreamEvent | null {
    const dataLines = rawEvent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"));
    if (dataLines.length === 0) {
        return null;
    }

    const payloadText = dataLines.map((line) => line.slice(5).trim()).join("");
    if (!payloadText) {
        return null;
    }

    try {
        return JSON.parse(payloadText) as ExecuteFlowStreamEvent;
    } catch {
        return null;
    }
}

function normalizeStoredGraph(graph?: ProjectGraphDto | null): {
    nodes: PlotFlowNode[];
    edges: Edge[];
} {
    if (!graph) {
        return { nodes: [], edges: [] };
    }

    const nodes = Array.isArray(graph.nodes)
        ? graph.nodes
            .filter((node) => typeof node.id === "string")
            .map((node, index) => {
                const data = node.data || {};
                const label = typeof data.label === "string" ? data.label : `Node ${index + 1}`;
                const kind = typeof data.kind === "string" ? data.kind : "Tool";
                const description =
                    typeof data.description === "string" ? data.description : "Workflow node";
                const toolData =
                    data.toolData && typeof data.toolData === "object"
                        ? (data.toolData as ToolData)
                        : ({ name: label } as ToolData);

                return {
                    id: node.id,
                    type: typeof node.type === "string" ? node.type : "plotNode",
                    position: {
                        x: typeof node.position?.x === "number" ? node.position.x : 0,
                        y: typeof node.position?.y === "number" ? node.position.y : 0,
                    },
                    data: {
                        ...data,
                        label,
                        kind,
                        description,
                        toolData: { ...toolData, name: toolData.name || label },
                    },
                } as PlotFlowNode;
            })
        : [];

    const validNodeIds = new Set(nodes.map((node) => node.id));
    const edges = Array.isArray(graph.edges)
        ? graph.edges
            .filter(
                (edge) =>
                    typeof edge.source === "string"
                    && typeof edge.target === "string"
                    && validNodeIds.has(edge.source)
                    && validNodeIds.has(edge.target)
            )
            .map((edge) => ({
                ...(edge as Edge),
                source: edge.source,
                target: edge.target,
            }))
        : [];

    return { nodes, edges };
}

function FlowNodeCard({ data }: NodeProps<PlotFlowNode>) {
    return (
        <div className="min-w-[220px] rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-md shadow-gray-300/40 font-mono text-gray-900 dark:border-[#333639] dark:bg-[#1e1f22] dark:text-[#e3e3e3] dark:shadow-black/30">
            <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-gray-400 dark:!bg-[#c4c7c5]" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-[#c4c7c5]">{data.kind}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-[#e3e3e3]">{data.label}</p>
            <p className="text-xs text-gray-500 dark:text-[#c4c7c5]">{data.description}</p>
            <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-gray-400 dark:!bg-[#c4c7c5]" />
        </div>
    );
}

const nodeTypes = {
    plotNode: FlowNodeCard,
};

function EditorShell({ projectId }: PlotStudioEditorProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<StudioTab>("visual");
    const [projectTitle, setProjectTitle] = useState("Plot Studio");
    const [projectError, setProjectError] = useState<string | null>(null);
    const [chatDraft, setChatDraft] = useState("");
    const [nodes, setNodes, onNodesChange] = useNodesState<PlotFlowNode>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [runError, setRunError] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [executionLogs, setExecutionLogs] = useState<FlowExecutionLog[]>([]);
    const [finalOutput, setFinalOutput] = useState<unknown>(null);
    const [isProjectLoading, setIsProjectLoading] = useState(Boolean(projectId));
    const [projectLoaded, setProjectLoaded] = useState(!projectId);
    const [terminalOpen, setTerminalOpen] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

    const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedSnapshotRef = useRef<string>("");
    const terminalBottomRef = useRef<HTMLDivElement | null>(null);

    const { screenToFlowPosition, setCenter } = useReactFlow<PlotFlowNode, Edge>();

    const graphSnapshot = useMemo<ProjectGraphDto>(() => ({
        nodes: nodes.map((node) => ({
            id: node.id,
            type: node.type || "plotNode",
            position: node.position,
            data: node.data,
        })),
        edges: edges.map((edge) => ({
            id: edge.id ?? undefined,
            source: edge.source,
            target: edge.target,
            type: edge.type,
            animated: edge.animated,
            style: edge.style,
        })),
    }), [edges, nodes]);

    const serializedGraphSnapshot = useMemo(
        () => JSON.stringify(graphSnapshot),
        [graphSnapshot]
    );

    const persistProject = useCallback(async (silent: boolean) => {
        if (!projectId) {
            return;
        }

        setIsSaving(true);
        setProjectError(null);

        const payload: ProjectUpdatePayload = {
            graph: graphSnapshot,
        };

        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/projects/${projectId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                timeout: 12000,
            });
            if (!res.ok) {
                const detail = await readErrorMessage(
                    res,
                    `Failed to save project (HTTP ${res.status}).`
                );
                throw new Error(detail);
            }

            const updated = (await res.json()) as ProjectDto;
            if (updated.title) {
                setProjectTitle(updated.title);
            }
            lastSavedSnapshotRef.current = serializedGraphSnapshot;
            setLastSavedAt(new Date().toLocaleTimeString());
            if (!silent) {
                showToast("Project saved.", "success");
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save project.";
            setProjectError(message);
            showToast(message, "error");
        } finally {
            setIsSaving(false);
        }
    }, [graphSnapshot, projectId, serializedGraphSnapshot]);

    const fallbackRun = useCallback(async (payload: ExecuteFlowRequestPayload) => {
        const res = await fetchWithTimeout(`${API_BASE}/api/execute-flow`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            timeout: 60000,
        });
        if (!res.ok) {
            const detail = await readErrorMessage(
                res,
                `Flow execution failed (HTTP ${res.status}).`
            );
            throw new Error(detail);
        }

        const data = (await res.json()) as Partial<ExecuteFlowResponsePayload>;
        setExecutionLogs(Array.isArray(data.logs) ? data.logs : []);
        setFinalOutput(data.final_output ?? null);
    }, []);

    useEffect(() => {
        if (!projectId) {
            setProjectTitle("Plot Studio");
            setProjectError(null);
            setIsProjectLoading(false);
            setProjectLoaded(true);
            lastSavedSnapshotRef.current = serializedGraphSnapshot;
            return;
        }

        let cancelled = false;
        setIsProjectLoading(true);
        setProjectLoaded(false);

        const loadProject = async () => {
            setProjectError(null);
            try {
                const res = await fetchWithTimeout(`${API_BASE}/api/projects/${projectId}`, {
                    timeout: 10000,
                });
                if (!res.ok) {
                    const detail = await readErrorMessage(
                        res,
                        `Unable to load project (HTTP ${res.status}).`
                    );
                    throw new Error(detail);
                }

                const project = (await res.json()) as ProjectDto;
                if (cancelled) return;
                setProjectTitle(project.title || "Untitled Project");
                const normalizedGraph = normalizeStoredGraph(project.graph);
                setNodes(normalizedGraph.nodes);
                setEdges(normalizedGraph.edges);
                lastSavedSnapshotRef.current = JSON.stringify({
                    nodes: normalizedGraph.nodes.map((node) => ({
                        id: node.id,
                        type: node.type || "plotNode",
                        position: node.position,
                        data: node.data,
                    })),
                    edges: normalizedGraph.edges.map((edge) => ({
                        id: edge.id ?? undefined,
                        source: edge.source,
                        target: edge.target,
                        type: edge.type,
                        animated: edge.animated,
                        style: edge.style,
                    })),
                });
            } catch (err) {
                if (cancelled) return;
                setProjectTitle("Unknown Project");
                setProjectError(err instanceof Error ? err.message : "Failed to load project.");
            } finally {
                if (!cancelled) {
                    setIsProjectLoading(false);
                    setProjectLoaded(true);
                }
            }
        };

        void loadProject();
        return () => {
            cancelled = true;
        };
    }, [projectId, serializedGraphSnapshot, setEdges, setNodes]);

    useEffect(() => {
        if (!projectId || !projectLoaded) {
            return;
        }
        if (serializedGraphSnapshot === lastSavedSnapshotRef.current) {
            return;
        }

        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }
        autosaveTimeoutRef.current = setTimeout(() => {
            void persistProject(true);
        }, 1200);

        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
        };
    }, [persistProject, projectId, projectLoaded, serializedGraphSnapshot]);

    useEffect(() => {
        if (!terminalOpen || !terminalBottomRef.current) {
            return;
        }
        terminalBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }, [executionLogs, runError, terminalOpen]);

    useEffect(() => {
        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
        };
    }, []);

    const onConnect = useCallback(
        (connection: Connection) => {
            setEdges((currentEdges) =>
                addEdge(
                    {
                        ...connection,
                        type: "smoothstep",
                        animated: true,
                        style: { stroke: "#a1a1aa", strokeWidth: 1.4 },
                    },
                    currentEdges
                )
            );
        },
        [setEdges]
    );

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    const handleDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();

            const droppedType =
                event.dataTransfer.getData(TOOLBOX_NODE_TYPE_MIME) ||
                event.dataTransfer.getData("application/reactflow");
            const toolDataRaw = event.dataTransfer.getData(TOOLBOX_NODE_DATA_MIME);
            if (!droppedType || !toolDataRaw) return;

            try {
                const toolData = JSON.parse(toolDataRaw) as ToolData;
                const position = screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                });

                const node: PlotFlowNode = {
                    id: crypto.randomUUID(),
                    type: "plotNode",
                    position,
                    data: {
                        label: toolData.name || "Untitled Node",
                        kind: toolData.category || "Tool",
                        description:
                            (typeof toolData.description === "string" && toolData.description) ||
                            "Workflow node",
                        toolData,
                    },
                };

                setNodes((currentNodes) => currentNodes.concat(node));
            } catch {
                setRunError("Failed to parse dropped tool data.");
                showToast("Failed to parse dropped tool data.", "error");
            }
        },
        [screenToFlowPosition, setNodes]
    );

    const handleSearchNode = useCallback(() => {
        if (nodes.length === 0) {
            showToast("No nodes available to search.", "info");
            return;
        }

        const query = window.prompt("Search node label");
        if (!query) {
            return;
        }

        const normalized = query.trim().toLowerCase();
        if (!normalized) {
            return;
        }

        const match = nodes.find((node) =>
            String(node.data?.label || "").toLowerCase().includes(normalized)
        );
        if (!match) {
            showToast(`No node matches "${query}".`, "error");
            return;
        }

        void setCenter(match.position.x, match.position.y, { zoom: 1.2, duration: 500 });
        showToast(`Focused "${String(match.data?.label || match.id)}".`, "success");
    }, [nodes, setCenter]);

    const handleRunFlow = useCallback(async () => {
        setRunError(null);
        setFinalOutput(null);
        setExecutionLogs([]);

        if (nodes.length === 0) {
            setTerminalOpen(true);
            setRunError("Add at least one node before running the flow.");
            showToast("Add at least one node before running the flow.", "error");
            return;
        }

        const payload: ExecuteFlowRequestPayload = {
            nodes: graphSnapshot.nodes.map((node) => ({
                id: node.id,
                type: node.type || "plotNode",
                data: node.data,
            })),
            edges: graphSnapshot.edges.map((edge) => ({
                id: edge.id ?? null,
                source: edge.source,
                target: edge.target,
            })),
            initial_input: {
                project_id: projectId || null,
            },
        };

        setIsRunning(true);
        setTerminalOpen(true);
        setActiveTab("visual");

        try {
            const res = await fetch(`${API_BASE}/api/execute-flow/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const detail = await readErrorMessage(
                    res,
                    `Flow execution failed (HTTP ${res.status}).`
                );
                throw new Error(detail);
            }

            if (!res.body) {
                await fallbackRun(payload);
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let completed = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                let splitIndex = buffer.indexOf("\n\n");
                while (splitIndex !== -1) {
                    const rawEvent = buffer.slice(0, splitIndex).trim();
                    buffer = buffer.slice(splitIndex + 2);
                    splitIndex = buffer.indexOf("\n\n");

                    if (!rawEvent) {
                        continue;
                    }

                    const parsed = parseSseEvent(rawEvent);
                    if (!parsed) {
                        continue;
                    }

                    if (parsed.type === "log") {
                        setExecutionLogs((current) => current.concat(parsed.log));
                    } else if (parsed.type === "completed") {
                        completed = true;
                        setExecutionLogs(Array.isArray(parsed.logs) ? parsed.logs : []);
                        setFinalOutput(parsed.final_output ?? null);
                    } else if (parsed.type === "error") {
                        throw new Error(parsed.detail || "Flow execution failed.");
                    }
                }
            }

            if (!completed) {
                await fallbackRun(payload);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Flow execution failed.";
            setRunError(message);
            showToast(message, "error");
        } finally {
            setIsRunning(false);
        }
    }, [fallbackRun, graphSnapshot.edges, graphSnapshot.nodes, nodes.length, projectId]);

    return (
        <div className="h-[100vh] w-full overflow-hidden bg-white text-gray-900 dark:bg-[#131314] dark:text-[#e3e3e3] flex flex-col font-mono">
            <header className="h-16 shrink-0 border-b border-gray-200 bg-white px-4 flex items-center justify-between gap-4 dark:border-[#333639] dark:bg-[#131314]">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={() => router.push("/workspace/automations")}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 dark:border-[#333639] dark:bg-[#1e1f22] dark:text-[#e3e3e3] dark:hover:bg-[#282a2c]"
                    >
                        <span aria-hidden="true" className="text-base leading-none">
                            {"<"}
                        </span>
                        <span>Back to Main Workspace</span>
                    </button>
                    {projectError && <p className="truncate text-xs text-red-400">{projectError}</p>}
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white p-1 dark:border-[#333639] dark:bg-[#1e1f22]">
                    <button
                        type="button"
                        onClick={() => setActiveTab("visual")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === "visual" ? "bg-gray-900 text-white dark:bg-[#282a2c] dark:text-[#e3e3e3]" : "text-gray-600 hover:bg-gray-100 dark:text-[#c4c7c5] dark:hover:bg-[#282a2c]"
                            }`}
                    >
                        Visual Editor
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("execution")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === "execution" ? "bg-gray-900 text-white dark:bg-[#282a2c] dark:text-[#e3e3e3]" : "text-gray-600 hover:bg-gray-100 dark:text-[#c4c7c5] dark:hover:bg-[#282a2c]"
                            }`}
                    >
                        Execution
                    </button>
                    <button
                        type="button"
                        onClick={() => void persistProject(false)}
                        disabled={!projectId || isSaving || isRunning || isProjectLoading}
                        className="h-8 px-3 inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 bg-white text-xs font-semibold text-gray-900 disabled:opacity-60 dark:border-[#333639] dark:bg-[#1e1f22] dark:text-[#e3e3e3]"
                        title={projectId ? "Save project" : "Create project from Automations page to save"}
                    >
                        {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleRunFlow()}
                        disabled={isRunning || isProjectLoading}
                        className="h-8 px-3 inline-flex items-center justify-center gap-1 rounded-md bg-gray-900 text-white text-xs font-semibold disabled:opacity-60 dark:bg-[#282a2c] dark:text-[#e3e3e3]"
                        title="Run"
                    >
                        {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                        {isRunning ? "Running..." : "Run"}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {lastSavedAt && (
                        <span className="hidden text-[11px] text-gray-500 dark:text-[#c4c7c5] md:inline">
                            Saved at {lastSavedAt}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={handleSearchNode}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-100 dark:border-[#333639] dark:bg-[#1e1f22] dark:hover:bg-[#282a2c]"
                        title="Search"
                    >
                        <Search size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => showToast("No notifications right now.", "info")}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-100 dark:border-[#333639] dark:bg-[#1e1f22] dark:hover:bg-[#282a2c]"
                        title="Notifications"
                    >
                        <Bell size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push("/workspace")}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-gray-900 text-white text-xs font-semibold dark:border dark:border-[#333639] dark:bg-[#1e1f22] dark:text-[#e3e3e3] dark:hover:bg-[#282a2c]"
                        title="Profile"
                    >
                        PA
                    </button>
                </div>
            </header>

            <div className="flex flex-1 min-h-0">
                <aside className="w-80 shrink-0 border-r border-gray-200 bg-white flex flex-col dark:border-[#333639] dark:bg-[#1e1f22]">
                    <div className="p-4 border-b border-gray-200 dark:border-[#333639]">
                        <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-[#c4c7c5]">
                            {projectId ? `Project ${projectId.slice(0, 8)}` : "Plot Studio"}
                        </p>
                        <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-[#e3e3e3]">{projectTitle}</p>
                        <p className="text-sm text-gray-700 dark:text-[#c4c7c5]">
                            Hello! I&apos;m the PlotAI assistant. What kind of automation do you want to build?
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
                        <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 dark:border-[#333639] dark:bg-[#1e1f22] dark:text-[#c4c7c5]">
                            Drop tools on the canvas, connect edges, and press Run to execute the graph end-to-end.
                        </div>
                    </div>

                    <div className="p-3 border-t border-gray-200 dark:border-[#333639]">
                        <div className="rounded-xl border border-gray-300 bg-white p-2 dark:border-[#333639] dark:bg-[#1e1f22]">
                            <textarea
                                value={chatDraft}
                                onChange={(event) => setChatDraft(event.target.value)}
                                placeholder="Ask, build... (Shift + Enter for new line)"
                                className="h-20 w-full resize-none border-0 bg-transparent p-1 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none dark:text-[#e3e3e3] dark:placeholder:text-[#c4c7c5]"
                            />
                            <div className="mt-2 flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => showToast("Attachment support is not implemented yet.", "info")}
                                        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-gray-300 hover:bg-gray-100 dark:border-[#333639] dark:hover:bg-[#282a2c]"
                                        title="Attach"
                                    >
                                        <Paperclip size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => showToast("Voice input is not implemented yet.", "info")}
                                        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-gray-300 hover:bg-gray-100 dark:border-[#333639] dark:hover:bg-[#282a2c]"
                                        title="Voice"
                                    >
                                        <Mic size={14} />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setChatDraft("");
                                        showToast("Draft cleared.", "info");
                                    }}
                                    className="h-8 px-3 inline-flex items-center justify-center gap-1 rounded-md bg-gray-900 text-white text-xs font-semibold dark:bg-[#282a2c] dark:text-[#e3e3e3]"
                                >
                                    <SendHorizontal size={14} />
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                </aside>

                <section className="flex-1 min-w-0 border-r border-gray-200 bg-white relative dark:border-[#333639] dark:bg-[#131314]">
                    {activeTab === "visual" ? (
                        <div className="h-full w-full flex flex-col">
                            <div className="min-h-0 flex-1 relative">
                                <FlowCanvas<PlotFlowNode, Edge>
                                    nodes={nodes}
                                    edges={edges}
                                    onNodesChange={onNodesChange}
                                    onEdgesChange={onEdgesChange}
                                    onConnect={onConnect}
                                    nodeTypes={nodeTypes}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    isEmpty={nodes.length === 0}
                                />
                                {isProjectLoading && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 dark:bg-[#131314]/80">
                                        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 dark:border-[#333639] dark:bg-[#1e1f22] dark:text-[#c4c7c5]">
                                            <Loader2 size={14} className="animate-spin" />
                                            Loading project...
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="shrink-0 border-t border-gray-200 bg-white dark:border-[#333639] dark:bg-[#1e1f22]">
                                <button
                                    type="button"
                                    onClick={() => setTerminalOpen((prev) => !prev)}
                                    className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-600 hover:bg-gray-50 dark:text-[#c4c7c5] dark:hover:bg-[#282a2c]"
                                >
                                    <span className="flex items-center gap-2">
                                        Execution Logs
                                        {isRunning && (
                                            <span className="inline-flex items-center gap-1 text-[11px] normal-case tracking-normal">
                                                <Loader2 size={11} className="animate-spin" />
                                                Running
                                            </span>
                                        )}
                                    </span>
                                    {terminalOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                </button>
                                {terminalOpen && (
                                    <div className="max-h-56 overflow-y-auto px-4 pb-3">
                                        {runError && (
                                            <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                                {runError}
                                            </div>
                                        )}
                                        {!runError && executionLogs.length === 0 && (
                                            <p className="mt-2 text-xs text-gray-500 dark:text-[#c4c7c5]">
                                                Run the flow to stream step-by-step logs.
                                            </p>
                                        )}
                                        {executionLogs.length > 0 && (
                                            <div className="mt-2 space-y-2">
                                                {executionLogs.map((log, index) => (
                                                    <div
                                                        key={`${log.node_id || "node"}-${index}`}
                                                        className={`rounded-md border px-2 py-1.5 text-xs ${
                                                            log.status === "failed"
                                                                ? "border-red-200 bg-red-50 text-red-700"
                                                                : "border-gray-200 bg-white text-gray-700 dark:border-[#333639] dark:bg-[#131314] dark:text-[#c4c7c5]"
                                                        }`}
                                                    >
                                                        <p>
                                                            [{log.status}] {log.node_name || "Node"}: {log.message}
                                                        </p>
                                                        {log.output_preview && (
                                                            <p className="mt-1 text-[11px] opacity-80">{log.output_preview}</p>
                                                        )}
                                                    </div>
                                                ))}
                                                <div ref={terminalBottomRef} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full w-full overflow-y-auto p-5 space-y-4">
                            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-[#333639] dark:bg-[#1e1f22]">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-[#e3e3e3]">Execution Logs</h3>
                                {runError && <p className="mt-2 text-sm text-red-400">{runError}</p>}
                                {!runError && executionLogs.length === 0 && (
                                    <p className="mt-2 text-sm text-gray-500 dark:text-[#c4c7c5]">
                                        Run the flow to see step-by-step logs.
                                    </p>
                                )}
                                {executionLogs.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {executionLogs.map((log, index) => (
                                            <div key={`${log.node_id || "node"}-${index}`} className="rounded-md border border-gray-200 bg-white p-2 text-xs dark:border-[#333639] dark:bg-[#1e1f22]">
                                                <p className="text-gray-700 dark:text-[#c4c7c5]">
                                                    [{log.status}] {log.node_name || "Node"}: {log.message}
                                                </p>
                                                {log.output_preview && (
                                                    <p className="mt-1 text-gray-500 dark:text-[#c4c7c5]">{log.output_preview}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-[#333639] dark:bg-[#1e1f22]">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-[#e3e3e3]">Final Output</h3>
                                <pre className="mt-2 overflow-auto rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700 dark:border-[#333639] dark:bg-[#1e1f22] dark:text-[#c4c7c5]">
                                    {finalOutput === null
                                        ? "No output yet."
                                        : JSON.stringify(finalOutput, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </section>

                <Toolbox />
            </div>
        </div>
    );
}

export default function PlotStudioEditor(props: PlotStudioEditorProps) {
    return (
        <ReactFlowProvider>
            <EditorShell {...props} />
        </ReactFlowProvider>
    );
}
