"use client";

import { useCallback, useEffect, useState } from "react";
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
    Mic,
    Paperclip,
    Play,
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
import { API_BASE, fetchWithTimeout } from "@/lib/api";

interface PlotStudioEditorProps {
    projectId?: string;
}

interface ProjectResponse {
    id: string;
    title: string;
    description?: string;
    updated_at: string;
}

type StudioTab = "visual" | "execution";

interface ToolData extends Record<string, unknown> {
    name: string;
    category?: string;
    kind?: string;
    description?: string;
    config?: Record<string, unknown>;
}

interface FlowNodeData extends Record<string, unknown> {
    label: string;
    kind: string;
    description: string;
    toolData: ToolData;
}

type PlotFlowNode = Node<FlowNodeData, "plotNode">;

interface ExecutionLog {
    node_id?: string;
    node_name?: string;
    status: string;
    message: string;
    output_preview?: string;
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
    const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
    const [finalOutput, setFinalOutput] = useState<unknown>(null);
    const { screenToFlowPosition } = useReactFlow<PlotFlowNode, Edge>();

    useEffect(() => {
        if (!projectId) {
            setProjectTitle("Plot Studio");
            setProjectError(null);
            return;
        }

        let cancelled = false;

        const loadProject = async () => {
            setProjectError(null);
            try {
                const res = await fetchWithTimeout(`${API_BASE}/api/projects/${projectId}`, {
                    timeout: 10000,
                });
                if (!res.ok) {
                    throw new Error(`Unable to load project (HTTP ${res.status}).`);
                }

                const project = (await res.json()) as ProjectResponse;
                if (cancelled) return;
                setProjectTitle(project.title || "Untitled Project");
            } catch (err) {
                if (cancelled) return;
                setProjectTitle("Unknown Project");
                setProjectError(err instanceof Error ? err.message : "Failed to load project.");
            }
        };

        void loadProject();
        return () => {
            cancelled = true;
        };
    }, [projectId]);

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
            }
        },
        [screenToFlowPosition, setNodes]
    );

    const handleRunFlow = useCallback(async () => {
        setRunError(null);
        setFinalOutput(null);
        setExecutionLogs([]);

        if (nodes.length === 0) {
            setActiveTab("execution");
            setRunError("Add at least one node before running the flow.");
            return;
        }

        setIsRunning(true);
        setActiveTab("execution");

        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/execute-flow`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nodes: nodes.map((node) => ({
                        id: node.id,
                        type: node.type,
                        data: node.data,
                    })),
                    edges: edges.map((edge) => ({
                        id: edge.id,
                        source: edge.source,
                        target: edge.target,
                    })),
                    initial_input: {
                        project_id: projectId || null,
                    },
                }),
                timeout: 60000,
            });

            if (!res.ok) {
                let detail = `Flow execution failed (HTTP ${res.status}).`;
                try {
                    const payload = (await res.json()) as { detail?: string };
                    if (payload?.detail) detail = payload.detail;
                } catch {
                    // keep fallback detail
                }
                throw new Error(detail);
            }

            const payload = (await res.json()) as {
                logs?: ExecutionLog[];
                final_output?: unknown;
            };

            setExecutionLogs(Array.isArray(payload.logs) ? payload.logs : []);
            setFinalOutput(payload.final_output ?? null);
        } catch (err) {
            setRunError(err instanceof Error ? err.message : "Flow execution failed.");
        } finally {
            setIsRunning(false);
        }
    }, [edges, nodes, projectId]);

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
                        onClick={() => void handleRunFlow()}
                        disabled={isRunning}
                        className="h-8 px-3 inline-flex items-center justify-center gap-1 rounded-md bg-gray-900 text-white text-xs font-semibold disabled:opacity-60 dark:bg-[#282a2c] dark:text-[#e3e3e3]"
                        title="Run"
                    >
                        <Play size={13} />
                        {isRunning ? "Running..." : "Run"}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-100 dark:border-[#333639] dark:bg-[#1e1f22] dark:hover:bg-[#282a2c]"
                        title="Search"
                    >
                        <Search size={15} />
                    </button>
                    <button
                        type="button"
                        className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-100 dark:border-[#333639] dark:bg-[#1e1f22] dark:hover:bg-[#282a2c]"
                        title="Notifications"
                    >
                        <Bell size={15} />
                    </button>
                    <button
                        type="button"
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
                                    <button type="button" className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-gray-300 hover:bg-gray-100 dark:border-[#333639] dark:hover:bg-[#282a2c]" title="Attach">
                                        <Paperclip size={14} />
                                    </button>
                                    <button type="button" className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-gray-300 hover:bg-gray-100 dark:border-[#333639] dark:hover:bg-[#282a2c]" title="Voice">
                                        <Mic size={14} />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setChatDraft("")}
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
