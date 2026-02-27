"use client";

import { useUIStore } from "@/store/uiStore";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function OtherToolsMenu() {
    const { otherToolsMenuOpen, setOtherToolsMenuOpen, setToolExecutionStart, isToolExecuting } = useUIStore();
    const [localLoading, setLocalLoading] = useState(false);

    // Mock API call to FastAPI backend
    const triggerTool = async (toolName: string) => {
        if (isToolExecuting || localLoading) return;

        setLocalLoading(true);
        setOtherToolsMenuOpen(false);

        try {
            const res = await fetch("http://localhost:8000/api/tools/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tool_name: toolName,
                    arguments: { topic: "AI Agents" } // Example args
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setToolExecutionStart(data.task_id, data.execution_id);
            } else {
                console.error("Failed to start tool execution");
            }
        } catch (error) {
            console.error("API error:", error);
        } finally {
            setLocalLoading(false);
        }
    };

    const tools = [
        { id: "AIResearch", name: "AI Research", icon: "🔍", desc: "Long-running web research task" },
        { id: "Automation", name: "Automation", icon: "⚙️", desc: "Trigger background workflows" },
        { id: "UIUXDesigner", name: "UI/UX Planner", icon: "✨", desc: "Draft multi-component designs" }
    ];

    return (
        <AnimatePresence>
            {otherToolsMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                    className="absolute top-12 right-0 z-50 w-64 pt-2"
                >
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden p-2 flex flex-col gap-1">
                        {tools.map((tool, i) => (
                            <motion.button
                                key={tool.id}
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
                                onClick={() => triggerTool(tool.id)}
                                className="flex items-start gap-3 p-3 w-full text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                            >
                                <div className="text-xl pt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                    {tool.icon}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                        {tool.name}
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                        {tool.desc}
                                    </span>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
