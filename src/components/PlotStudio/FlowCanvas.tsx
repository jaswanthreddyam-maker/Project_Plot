"use client";

import type {
    Edge,
    Node,
    NodeTypes,
    OnConnect,
    OnEdgesChange,
    OnNodesChange,
} from "@xyflow/react";
import { Background, BackgroundVariant, Controls, ReactFlow } from "@xyflow/react";
import { useTheme } from "next-themes";

interface FlowCanvasProps<TNode extends Node = Node, TEdge extends Edge = Edge> {
    nodes: TNode[];
    edges: TEdge[];
    onNodesChange: OnNodesChange<TNode>;
    onEdgesChange: OnEdgesChange<TEdge>;
    onConnect: OnConnect;
    nodeTypes?: NodeTypes;
    onDragOver: React.DragEventHandler<HTMLDivElement>;
    onDrop: React.DragEventHandler<HTMLDivElement>;
    isEmpty: boolean;
    emptyText?: string;
}

export default function FlowCanvas<TNode extends Node = Node, TEdge extends Edge = Edge>({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    nodeTypes,
    onDragOver,
    onDrop,
    isEmpty,
    emptyText = "Start building your automation workflow. Drag and drop Tasks, Agents and Tools...",
}: FlowCanvasProps<TNode, TEdge>) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    return (
        <div className="h-full w-full bg-white dark:bg-[#131314]" onDragOver={onDragOver} onDrop={onDrop}>
            {isEmpty && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
                    <p className="max-w-md text-center text-sm text-gray-500 dark:text-[#c4c7c5]">{emptyText}</p>
                </div>
            )}
            <ReactFlow<TNode, TEdge>
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                colorMode={isDark ? "dark" : "light"}
                fitView
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={12}
                    size={1}
                    color={isDark ? "#333639" : "#ccc"}
                />
                <Controls position="bottom-left" />
            </ReactFlow>
        </div>
    );
}
