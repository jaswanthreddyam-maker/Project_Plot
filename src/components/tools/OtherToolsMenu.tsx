"use client";

import { useUIStore } from "@/store/uiStore";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function OtherToolsMenu() {
    const {
        otherToolsMenuOpen,
        setOtherToolsMenuOpen,
        setToolExecutionStart,
        isToolExecuting,
        codeMentorMode,
        toggleCodeMentorMode,
        setActiveWorkspace
    } = useUIStore();

    const [loadingTool, setLoadingTool] = useState<string | null>(null);

    const triggerTool = async (toolId: string) => {
        if (isToolExecuting || loadingTool) return;

        // Force close menu immediately for all tool interactions before any other logic
        setOtherToolsMenuOpen(false);

        if (toolId === "CodeMentor") {
            toggleCodeMentorMode();
            return;
        }

        setLoadingTool(toolId);

        if (toolId === "PlotAutonomous") {
            setActiveWorkspace("autonomous");
        }

        try {
            const res = await fetch("http://localhost:8000/api/tools/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tool_name: toolId,
                    arguments: { topic: "AI Agents" } // Example args
                }),
            });

            if (res.ok) {
                const data = await res.json();
                // Ensure immediate UI mount of ToolExecutionStream
                setToolExecutionStart(data.task_id, data.execution_id || data.task_id);
            } else {
                console.error("Failed to start tool execution");
            }
        } catch (error) {
            console.error("API error:", error);
        } finally {
            setLoadingTool(null);
        }
    };

    const tools = [
        { id: "CodeMentor", name: "Code Mentor", desc: codeMentorMode ? "Disable Code Mentor mode" : "Enable Code Mentor mode" },
        { id: "PlotAutonomous", name: "Plot Autonomous", desc: "Long-running autonomous agent workflows" }
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
                                <div className="flex flex-col w-full">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {tool.name}
                                            {loadingTool === tool.id && (
                                                <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-medium">
                                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full" />
                                                    Starting...
                                                </span>
                                            )}
                                        </div>
                                        {tool.id === "CodeMentor" && codeMentorMode && (
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        )}
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
