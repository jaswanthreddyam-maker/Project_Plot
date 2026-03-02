"use client";

import { useMemo, useState } from "react";
import { ChevronDown, GripVertical, Search } from "lucide-react";

export const TOOLBOX_NODE_TYPE = "customNode";
export const TOOLBOX_NODE_TYPE_MIME = "application/x-plot-node-type";
export const TOOLBOX_NODE_DATA_MIME = "application/x-plot-tool-data";

export type ToolboxKind = "task" | "agent" | "tool";
export type ToolboxCategory =
    | "Crew"
    | "AI & Machine Learning"
    | "Integrations"
    | "Data & APIs";

export interface ToolboxItem {
    name: string;
    category: ToolboxCategory;
    kind: ToolboxKind;
    description: string;
}

interface ToolboxProps {
    className?: string;
}

const CREW_ITEMS: ToolboxItem[] = [
    {
        name: "Task",
        category: "Crew",
        kind: "task",
        description: "Define a discrete workflow action.",
    },
    {
        name: "Agent",
        category: "Crew",
        kind: "agent",
        description: "Add a role that executes tasks.",
    },
];

const TOOL_ITEMS: ToolboxItem[] = [
    {
        name: "Classifier",
        category: "AI & Machine Learning",
        kind: "tool",
        description: "Categorize text into labels.",
    },
    {
        name: "Summarizer",
        category: "AI & Machine Learning",
        kind: "tool",
        description: "Generate concise summaries.",
    },
    {
        name: "Webhook",
        category: "Integrations",
        kind: "tool",
        description: "Send payloads to an external endpoint.",
    },
    {
        name: "Slack Action",
        category: "Integrations",
        kind: "tool",
        description: "Push a message to Slack webhook.",
    },
    {
        name: "HTTP Request",
        category: "Data & APIs",
        kind: "tool",
        description: "Call an external REST API.",
    },
    {
        name: "Data Mapper",
        category: "Data & APIs",
        kind: "tool",
        description: "Transform JSON structure using key mappings.",
    },
];

function DraggableToolCard({ item }: { item: ToolboxItem }) {
    const handleDragStart = (event: React.DragEvent<HTMLButtonElement>) => {
        event.dataTransfer.setData(TOOLBOX_NODE_TYPE_MIME, TOOLBOX_NODE_TYPE);
        event.dataTransfer.setData(TOOLBOX_NODE_DATA_MIME, JSON.stringify(item));
        // Compatibility channel commonly used by React Flow examples.
        event.dataTransfer.setData("application/reactflow", TOOLBOX_NODE_TYPE);
        event.dataTransfer.effectAllowed = "move";
    };

    return (
        <button
            type="button"
            draggable
            onDragStart={handleDragStart}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-gray-300 dark:border-[#333639] dark:bg-[#1e1f22] dark:hover:border-[#333639] dark:hover:bg-[#282a2c]"
            title={`Drag ${item.name}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#e3e3e3]">{item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-[#c4c7c5]">{item.description}</p>
                </div>
                <GripVertical size={14} className="mt-0.5 shrink-0 text-gray-500 dark:text-[#c4c7c5]" />
            </div>
        </button>
    );
}

export default function Toolbox({ className }: ToolboxProps) {
    const [search, setSearch] = useState("");
    const [crewOpen, setCrewOpen] = useState(true);
    const [toolsOpen, setToolsOpen] = useState(true);

    const filteredTools = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return TOOL_ITEMS;
        return TOOL_ITEMS.filter((item) =>
            `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(query)
        );
    }, [search]);

    const groupedTools = useMemo(() => {
        const groups = new Map<ToolboxCategory, ToolboxItem[]>();
        for (const item of filteredTools) {
            const existing = groups.get(item.category) || [];
            existing.push(item);
            groups.set(item.category, existing);
        }
        return groups;
    }, [filteredTools]);

    return (
        <aside className={`w-80 shrink-0 border-l border-gray-200 bg-white text-gray-900 flex flex-col font-mono dark:border-[#333639] dark:bg-[#1e1f22] dark:text-[#e3e3e3] ${className || ""}`}>
            <div className="border-b border-gray-200 px-4 py-3 dark:border-[#333639]">
                <p className="text-xs uppercase tracking-[0.22em] text-gray-500 dark:text-[#c4c7c5]">Toolbox</p>
                <h2 className="mt-1 text-sm font-semibold text-gray-900 dark:text-[#e3e3e3]">Flow Components</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                <section className="rounded-xl border border-gray-200 bg-white dark:border-[#333639] dark:bg-[#1e1f22]">
                    <button
                        type="button"
                        onClick={() => setCrewOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:text-[#e3e3e3] dark:hover:bg-[#282a2c]"
                    >
                        Crew
                        <ChevronDown size={16} className={`transition-transform ${crewOpen ? "rotate-180" : ""}`} />
                    </button>
                    {crewOpen && (
                        <div className="border-t border-gray-200 space-y-2 p-3 dark:border-[#333639]">
                            {CREW_ITEMS.map((item) => (
                                <DraggableToolCard key={item.name} item={item} />
                            ))}
                        </div>
                    )}
                </section>

                <section className="rounded-xl border border-gray-200 bg-white dark:border-[#333639] dark:bg-[#1e1f22]">
                    <button
                        type="button"
                        onClick={() => setToolsOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:text-[#e3e3e3] dark:hover:bg-[#282a2c]"
                    >
                        Tools
                        <ChevronDown size={16} className={`transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
                    </button>
                    {toolsOpen && (
                        <div className="border-t border-gray-200 space-y-3 p-3 dark:border-[#333639]">
                            <label className="relative block">
                                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-[#c4c7c5]" />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search tools..."
                                    className="h-9 w-full rounded-md border border-gray-300 bg-white pl-8 pr-2 text-xs text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-[#333639] dark:bg-[#1e1f22] dark:text-[#e3e3e3] dark:placeholder:text-[#c4c7c5] dark:focus:ring-[#333639]"
                                />
                            </label>

                            {groupedTools.size === 0 ? (
                                <p className="text-xs text-gray-500 dark:text-[#c4c7c5]">No tools found for this search.</p>
                            ) : (
                                Array.from(groupedTools.entries()).map(([category, items]) => (
                                    <div key={category} className="space-y-2">
                                        <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 dark:text-[#c4c7c5]">
                                            {category}
                                        </p>
                                        <div className="space-y-2">
                                            {items.map((item) => (
                                                <DraggableToolCard key={`${category}-${item.name}`} item={item} />
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </section>
            </div>
        </aside>
    );
}
