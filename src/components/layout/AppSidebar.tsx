"use client";

import { useUIStore, AmpRoute, AgentConfig, TaskConfig } from "@/store/uiStore";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
 * Navigation definition — matches CrewAI Enterprise sidebar
 * ═══════════════════════════════════════════════════════════════ */

interface NavItem {
    id: AmpRoute;
    label: string;
    icon: React.ReactNode;
}

interface NavSection {
    title: string;
    items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
    {
        title: "BUILD",
        items: [
            {
                id: "automations",
                label: "Automations",
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                ),
            },
            {
                id: "crew-studio",
                label: "Crew Studio",
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                ),
            },
            {
                id: "agents-repository",
                label: "Agents Repository",
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                ),
            },
            {
                id: "tools-integrations",
                label: "Tools & Integrations",
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                ),
            },
        ],
    },
    {
        title: "OPERATE",
        items: [
            {
                id: "traces",
                label: "Traces",
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                ),
            },
            {
                id: "llm-connections",
                label: "LLM Connections",
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                ),
            },
            {
                id: "environment-variables",
                label: "Environment Variables",
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                ),
            },
        ],
    },
    {
        title: "MANAGE",
        items: [
            {
                id: "usage",
                label: "Usage",
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                ),
            },
            {
                id: "billing",
                label: "Billing",
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                ),
            },
            {
                id: "settings",
                label: "Settings",
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                ),
            },
        ],
    },
];

export default function AppSidebar() {
    const activeAmpRoute = useUIStore((s) => s.activeAmpRoute);
    const setActiveAmpRoute = useUIStore((s) => s.setActiveAmpRoute);
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // ── Crew Config from store (merged from AgentDashboard left panel) ──
    const agentConfig = useUIStore((s) => s.agentConfig);
    const setAgentConfig = useUIStore((s) => s.setAgentConfig);
    const taskConfig = useUIStore((s) => s.taskConfig);
    const setTaskConfig = useUIStore((s) => s.setTaskConfig);
    const selectedAgentId = useUIStore((s) => s.selectedAgentId);
    const setSelectedAgentId = useUIStore((s) => s.setSelectedAgentId);
    const selectedTaskId = useUIStore((s) => s.selectedTaskId);
    const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);
    const activeProviders = useUIStore((s) => s.activeProviders);

    useEffect(() => setMounted(true), []);

    // Show crew config section when on agents-repository route
    const showCrewConfig = activeAmpRoute === "agents-repository";

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

    return (
        <aside className="w-56 flex flex-col h-full bg-white dark:bg-[#171717] border-r border-slate-200 dark:border-slate-800 shrink-0">
            {/* ── Logo ── */}
            <div className="px-5 py-5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white dark:text-slate-900">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5" />
                            <path d="M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight italic">
                        PlotAI
                    </span>
                </div>
            </div>

            {/* ── Navigation Sections ── */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
                {NAV_SECTIONS.map((section) => (
                    <div key={section.title}>
                        <h4 className="px-2 mb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            {section.title}
                        </h4>
                        <div className="space-y-0.5">
                            {section.items.map((item) => {
                                const isActive = activeAmpRoute === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setActiveAmpRoute(item.id);
                                        }}
                                        className={`
                                            w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                                            ${isActive
                                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                                            }
                                        `}
                                    >
                                        <span className={isActive ? "text-white dark:text-slate-900" : "text-slate-500 dark:text-slate-400"}>
                                            {item.icon}
                                        </span>
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* ── Crew Configuration (merged from AgentDashboard) ── */}
                {showCrewConfig && (
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                        <h4 className="px-2 mb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            CREW CONFIG
                        </h4>

                        {/* Agents */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between px-2 mb-1.5">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Agents</span>
                                <button onClick={addAgent} className="text-indigo-500 hover:text-indigo-600 text-[10px] font-bold">+ New</button>
                            </div>
                            <div className="space-y-0.5">
                                {agentConfig.map((agent) => (
                                    <button
                                        key={agent.id}
                                        onClick={() => setSelectedAgentId(agent.id)}
                                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors truncate ${selectedAgentId === agent.id
                                            ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold"
                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            }`}
                                    >
                                        {agent.role || "Untitled Agent"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tasks */}
                        <div>
                            <div className="flex items-center justify-between px-2 mb-1.5">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tasks</span>
                                <button onClick={addTask} className="text-indigo-500 hover:text-indigo-600 text-[10px] font-bold">+ New</button>
                            </div>
                            <div className="space-y-0.5">
                                {taskConfig.map((task) => (
                                    <button
                                        key={task.id}
                                        onClick={() => setSelectedTaskId(task.id)}
                                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors truncate ${selectedTaskId === task.id
                                            ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold"
                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            }`}
                                    >
                                        <span className="line-clamp-1">{task.description || "Untitled Task"}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* ── Theme toggle ── */}
            <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => {
                        if (!mounted) return;
                        setTheme(theme === "dark" ? "light" : "dark");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                    suppressHydrationWarning
                >
                    {mounted && theme === "dark" ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    )}
                    {mounted ? (theme === "dark" ? "Light Mode" : "Dark Mode") : "Theme"}
                </button>
            </div>


        </aside>
    );
}
