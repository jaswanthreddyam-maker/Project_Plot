"use client";

import { useState, useEffect } from "react";
import { useUIStore } from "@/store/uiStore";

/* ═══════════════════════════════════════════════════════════════
 * Tools & Integrations — Enterprise-grade integrations dashboard
 * Modeled after CrewAI's "Agent Apps / Internal Tools / Integrations" tabs
 * ═══════════════════════════════════════════════════════════════ */

type TabId = "agent-apps" | "internal-tools" | "integrations";

interface IntegrationTool {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    iconBg: string;
    activeCount: number;
    connected: boolean;
    category: string;
}

const INTEGRATIONS: IntegrationTool[] = [
    {
        id: "asana", name: "Asana",
        description: "Connect to your users' Asana account to access, create, and update their tasks or projects in Asana.",
        icon: <span className="text-lg font-black text-red-500">●</span>,
        iconBg: "bg-white dark:bg-slate-800",
        activeCount: 0, connected: false, category: "Project Management",
    },
    {
        id: "github", name: "GitHub",
        description: "Connect to your GitHub account to manage your issues, releases, repositories, and more in GitHub.",
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-slate-900 dark:text-white">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
        ),
        iconBg: "bg-white dark:bg-slate-800",
        activeCount: 3, connected: true, category: "Developer Tools",
    },
    {
        id: "slack", name: "Slack",
        description: "Send messages, manage channels, and automate workflows directly within your Slack workspace.",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="0">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
                <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0" />
                <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D" />
                <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E" />
            </svg>
        ),
        iconBg: "bg-white dark:bg-slate-800",
        activeCount: 5, connected: true, category: "Communication",
    },
    {
        id: "confluence", name: "Confluence",
        description: "Connect to your Confluence account access, create, and update your documents in Confluence.",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M1.57 17.82c-.2.34-.43.72-.62 1.02a.76.76 0 00.27 1.04l4.78 2.88a.77.77 0 001.05-.28c.17-.29.39-.64.64-1.04 1.78-2.87 3.57-2.53 6.83-1.06l4.82 2.17a.77.77 0 001.01-.4l2.19-5.08a.76.76 0 00-.38-1.01c-.52-.24-1.38-.62-2.44-1.1-5.7-2.57-10.6-3.13-18.15 2.86z" fill="#2684FF" />
                <path d="M22.43 6.18c.2-.34.43-.72.62-1.02a.76.76 0 00-.27-1.04L18 1.24a.77.77 0 00-1.05.28c-.17.29-.39.64-.64 1.04-1.78 2.87-3.57 2.53-6.83 1.06L4.66 1.45a.77.77 0 00-1.01.4L1.46 6.93a.76.76 0 00.38 1.01c.52.24 1.38.62 2.44 1.1 5.7 2.57 10.6 3.13 18.15-2.86z" fill="#2684FF" />
            </svg>
        ),
        iconBg: "bg-white dark:bg-slate-800",
        activeCount: 0, connected: false, category: "Documentation",
    },
    {
        id: "gmail", name: "Gmail",
        description: "Send, receive, and manage Gmail messages and email settings. Automate email workflows for agents.",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z" fill="#EA4335" />
            </svg>
        ),
        iconBg: "bg-white dark:bg-slate-800",
        activeCount: 2, connected: true, category: "Communication",
    },
    {
        id: "google-calendar", name: "Google Calendar",
        description: "Integrate with Google Calendar to manage events, check availability, and access calendar data.",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="2" fill="none" />
                <line x1="3" y1="10" x2="21" y2="10" stroke="#4285F4" strokeWidth="2" />
                <line x1="8" y1="2" x2="8" y2="6" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" />
                <line x1="16" y1="2" x2="16" y2="6" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" />
                <text x="7" y="18" fontSize="7" fill="#4285F4" fontWeight="bold">31</text>
            </svg>
        ),
        iconBg: "bg-white dark:bg-slate-800",
        activeCount: 0, connected: false, category: "Productivity",
    },
    {
        id: "clickup", name: "ClickUp",
        description: "Connect to your ClickUp account to manage your tasks in ClickUp. Keeping your ClickUp spaces up-to-date.",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 16.5l4-3.5 4 4 8-8" stroke="#7B68EE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        iconBg: "bg-white dark:bg-slate-800",
        activeCount: 0, connected: false, category: "Project Management",
    },
    {
        id: "box", name: "Box",
        description: "Connect to your Box account to access, create, and update files in Box. Increase productivity.",
        icon: <span className="text-base font-black text-blue-600">box</span>,
        iconBg: "bg-white dark:bg-slate-800",
        activeCount: 0, connected: false, category: "Storage",
    },
    {
        id: "google-docs", name: "Google Docs",
        description: "Create, read, and edit Google Docs documents. Automate document workflows for your agents.",
        icon: (
            <svg width="18" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#4285F4" strokeWidth="2" fill="none" />
                <path d="M14 2v6h6" stroke="#4285F4" strokeWidth="2" />
                <line x1="8" y1="13" x2="16" y2="13" stroke="#4285F4" strokeWidth="1.5" />
                <line x1="8" y1="17" x2="14" y2="17" stroke="#4285F4" strokeWidth="1.5" />
            </svg>
        ),
        iconBg: "bg-white dark:bg-slate-800",
        activeCount: 0, connected: false, category: "Documentation",
    },
];

const TABS: { id: TabId; label: string }[] = [
    { id: "agent-apps", label: "Agent Apps" },
    { id: "internal-tools", label: "Internal Tools" },
    { id: "integrations", label: "Integrations" },
];

const STATUS_OPTIONS = ["All", "Connected", "Not Connected"];

export default function ToolsIntegrations() {
    const activeTab = useUIStore((s) => s.activeAmpRoute === "tools-integrations" ? "integrations" : "agent-apps"); // just a default
    const [localTab, setLocalTab] = useState<TabId>("agent-apps");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [authToken, setAuthToken] = useState("");
    const [tokenRevealed, setTokenRevealed] = useState(false);
    const [copiedToken, setCopiedToken] = useState(false);

    // Store integration tokens in a local dictionary for the inputs
    const [inputTokens, setInputTokens] = useState<Record<string, string>>({});
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const connectedIntegrations = useUIStore((s) => s.connectedIntegrations);
    const setConnectedIntegrations = useUIStore((s) => s.setConnectedIntegrations);
    const addConnectedIntegration = useUIStore((s) => s.addConnectedIntegration);
    const removeConnectedIntegration = useUIStore((s) => s.removeConnectedIntegration);

    // Fetch initial state
    useEffect(() => {
        const fetchIntegrations = async () => {
            try {
                const res = await fetch("/api/settings/integrations");
                if (res.ok) {
                    const data = await res.json();

                    // Extract enterprise auth token if it exists
                    const enterpriseToken = data.integrations.find((t: any) => t.provider === "enterprise-auth");
                    if (enterpriseToken) {
                        setAuthToken(enterpriseToken.token_masked);
                    }

                    // Extract all connected tools (excluding enterprise-auth)
                    const connectedProviders = data.integrations
                        .map((t: any) => t.provider)
                        .filter((p: string) => p !== "enterprise-auth");

                    setConnectedIntegrations(connectedProviders);
                }
            } catch (err) {
                console.error("Failed to fetch integrations", err);
            }
        };
        fetchIntegrations();
    }, [setConnectedIntegrations]);

    const filteredTools = INTEGRATIONS.map((tool) => ({
        ...tool,
        connected: connectedIntegrations.includes(tool.id)
    })).filter((tool) => {
        const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tool.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "All" ||
            (statusFilter === "Connected" && tool.connected) ||
            (statusFilter === "Not Connected" && !tool.connected);
        return matchesSearch && matchesStatus;
    });

    const handleCopyToken = async () => {
        try {
            await navigator.clipboard.writeText(authToken);
            setCopiedToken(true);
            setTimeout(() => setCopiedToken(false), 2000);
        } catch { /* noop */ }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-y-auto bg-white dark:bg-[#171717]">
            <div className="p-6 md:p-8 max-w-6xl mx-auto w-full">

                {/* ── Page Header ── */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Tools & Integrations</h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Manage apps, internal tools, and MCP servers for your CrewAI agents</p>
                    </div>
                </div>

                {/* ── Tabs ── */}
                <div className="border-b border-slate-200 dark:border-slate-800 mb-6">
                    <div className="flex gap-6">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setLocalTab(tab.id)}
                                className={`
                                    pb-3 text-sm font-medium transition-colors relative
                                    ${localTab === tab.id
                                        ? "text-slate-900 dark:text-white"
                                        : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    }
                                `}
                            >
                                {tab.label}
                                {localTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Tab Content ── */}
                {localTab === "agent-apps" && (
                    <>
                        {/* Section Header */}
                        <div className="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4">
                            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500 dark:text-slate-400">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Agent Apps</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Enterprise-grade applications that agents can use with organization permissions. Securely authenticated through provider platform.</p>
                            </div>
                        </div>

                        {/* Search & Filter */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                            <div className="relative flex-1">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search"
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-slate-400"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Filter by:</span>
                                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5">
                                    <span className="text-xs text-slate-600 dark:text-slate-300 px-2 font-medium">Status</span>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="text-xs bg-transparent border-none focus:outline-none text-slate-600 dark:text-slate-300 cursor-pointer pr-1"
                                    >
                                        {STATUS_OPTIONS.map((opt) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Integration Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredTools.map((tool) => (
                                <div
                                    key={tool.id}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
                                >
                                    {/* Card Content */}
                                    <div className="p-5">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-lg ${tool.iconBg} border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0`}>
                                                {tool.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{tool.name}</h4>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{tool.description}</p>
                                            </div>
                                        </div>

                                        {/* Tags */}
                                        <div className="flex items-center gap-2 mt-3">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20">
                                                Agent App
                                            </span>
                                            {tool.connected ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                                                    Connected
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    Not Configured
                                                </span>
                                            )}
                                            {tool.activeCount > 0 && (
                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                                    {tool.activeCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Footer */}
                                    <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <button
                                            className={`text-xs font-semibold flex items-center gap-1.5 transition-colors ${tool.connected
                                                ? "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                                                : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                                }`}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                            </svg>
                                            {tool.connected ? "Manage" : "Connect"}
                                        </button>
                                        <button
                                            onClick={() => setExpandedCard(expandedCard === tool.id ? null : tool.id)}
                                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <svg
                                                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                className={`text-slate-400 transition-transform duration-200 ${expandedCard === tool.id ? "rotate-180" : ""}`}
                                            >
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Expanded Config Panel */}
                                    {expandedCard === tool.id && (
                                        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">API Key / OAuth Token</label>
                                                    <input
                                                        type="password"
                                                        value={inputTokens[tool.id] || ""}
                                                        onChange={(e) => setInputTokens({ ...inputTokens, [tool.id]: e.target.value })}
                                                        placeholder={`Enter ${tool.name} API key...`}
                                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-slate-400"
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={async () => {
                                                            const token = inputTokens[tool.id];
                                                            if (!token) return;
                                                            setLoadingAction(`connect-${tool.id}`);
                                                            try {
                                                                const res = await fetch("/api/settings/integrations", {
                                                                    method: "POST",
                                                                    headers: { "Content-Type": "application/json" },
                                                                    body: JSON.stringify({ provider: tool.id, token })
                                                                });
                                                                if (res.ok) {
                                                                    addConnectedIntegration(tool.id);
                                                                    setInputTokens({ ...inputTokens, [tool.id]: "" });
                                                                    setExpandedCard(null);
                                                                }
                                                            } catch (err) {
                                                                console.error("Failed to connect integration", err);
                                                            } finally {
                                                                setLoadingAction(null);
                                                            }
                                                        }}
                                                        disabled={loadingAction === `connect-${tool.id}`}
                                                        className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                                                    >
                                                        {loadingAction === `connect-${tool.id}` ? "Saving..." : "Save & Connect"}
                                                    </button>
                                                    {tool.connected && (
                                                        <button
                                                            onClick={async () => {
                                                                setLoadingAction(`disconnect-${tool.id}`);
                                                                try {
                                                                    const res = await fetch(`/api/settings/integrations/${tool.id}`, {
                                                                        method: "DELETE"
                                                                    });
                                                                    if (res.ok) {
                                                                        removeConnectedIntegration(tool.id);
                                                                        setExpandedCard(null);
                                                                    }
                                                                } catch (err) {
                                                                    console.error("Failed to disconnect", err);
                                                                } finally {
                                                                    setLoadingAction(null);
                                                                }
                                                            }}
                                                            disabled={loadingAction === `disconnect-${tool.id}`}
                                                            className="px-4 py-1.5 border border-red-200 dark:border-red-800 disabled:opacity-50 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                        >
                                                            {loadingAction === `disconnect-${tool.id}` ? "Disconnecting..." : "Disconnect"}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {filteredTools.length === 0 && (
                            <div className="text-center py-12">
                                <p className="text-sm text-slate-500 dark:text-slate-400">No integrations match your search.</p>
                            </div>
                        )}
                    </>
                )}

                {/* ── Internal Tools Tab ── */}
                {localTab === "internal-tools" && (
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
                        <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Internal Tools</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                            Create custom internal tools that your agents can use during execution. Define tool schemas, implement handlers, and test them here.
                        </p>
                        <button className="mt-6 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
                            + Create Tool
                        </button>
                    </div>
                )}

                {/* ── Integrations Tab ── */}
                {localTab === "integrations" && (
                    <div className="space-y-6">
                        {/* Auth Token Section */}
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Enterprise Action Auth Token</h3>
                                <button
                                    onClick={async () => {
                                        setLoadingAction("save-enterprise-auth");
                                        try {
                                            const res = await fetch("/api/settings/integrations", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ provider: "enterprise-auth", token: authToken })
                                            });
                                            if (res.ok) {
                                                const data = await res.json();
                                                setAuthToken(data.integration.token_masked);
                                                // Temporarily show checkmark by mimicking copied Token state
                                                setCopiedToken(true);
                                                setTimeout(() => setCopiedToken(false), 2000);
                                            }
                                        } catch (err) {
                                            console.error("Failed to save auth token", err);
                                        } finally {
                                            setLoadingAction(null);
                                        }
                                    }}
                                    disabled={loadingAction === "save-enterprise-auth" || !authToken || authToken.includes("•")}
                                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-500 text-white text-xs font-semibold rounded-lg transition-colors"
                                >
                                    {loadingAction === "save-enterprise-auth" ? "Saving..." : "Save Token"}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Use this token to authenticate agent actions with external services.</p>
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <input
                                        type={tokenRevealed ? "text" : "password"}
                                        value={authToken}
                                        onChange={(e) => setAuthToken(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white pr-20"
                                    />
                                    <button
                                        onClick={() => setTokenRevealed(!tokenRevealed)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        {tokenRevealed ? "Hide" : "Reveal"}
                                    </button>
                                </div>
                                <button
                                    onClick={handleCopyToken}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                                >
                                    {copiedToken ? "✓ Copied" : "Copy"}
                                </button>
                            </div>
                        </div>

                        {/* MCP Servers placeholder */}
                        <div className="bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center">
                            <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                                    <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">MCP Servers</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                Configure Model Context Protocol servers to extend your agents&apos; capabilities with external data sources and tools.
                            </p>
                            <button className="mt-6 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
                                + Add MCP Server
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
