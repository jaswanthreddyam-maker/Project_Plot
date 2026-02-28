"use client";

import { useState, useEffect, useCallback } from "react";
import { useUIStore, LLMConnectionEntry } from "@/store/uiStore";

/* ═══════════════════════════════════════════════════════════════
 * LLM Connections Page
 * Manage API key connections for LLM providers.
 * Syncs with backend GET/POST/DELETE /api/settings/llm-connections
 * ═══════════════════════════════════════════════════════════════ */

const PROVIDERS = [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "gemini", label: "Google Gemini" },
    { value: "groq", label: "Groq" },
    { value: "ollama", label: "Ollama (Local)" },
];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function LLMConnections() {
    const { llmConnections, setLlmConnections, addLlmConnection, removeLlmConnection } = useUIStore();

    // Form state
    const [provider, setProvider] = useState("openai");
    const [alias, setAlias] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Fetch connections on mount
    const fetchConnections = useCallback(async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/settings/llm-connections`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.connections)) {
                    setLlmConnections(data.connections);
                }
            }
        } catch {
            // Backend unavailable — keep Zustand state
        }
    }, [setLlmConnections]);

    useEffect(() => {
        fetchConnections();
    }, [fetchConnections]);

    const handleSave = async () => {
        if (!apiKey.trim()) {
            setError("API key is required.");
            return;
        }
        setSaving(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const res = await fetch(`${BACKEND_URL}/api/settings/llm-connections`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider,
                    alias: alias.trim() || `${provider}-default`,
                    api_key: apiKey,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                addLlmConnection(data.connection);
                setApiKey("");
                setAlias("");
                setSuccessMsg("Connection added successfully!");
                setTimeout(() => setSuccessMsg(null), 3000);
            } else {
                const errData = await res.json().catch(() => ({}));
                setError(errData.detail || "Failed to save connection.");
            }
        } catch {
            setError("Network error — is the backend running?");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fetch(`${BACKEND_URL}/api/settings/llm-connections/${id}`, { method: "DELETE" });
            removeLlmConnection(id);
        } catch {
            // Still remove locally
            removeLlmConnection(id);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-y-auto bg-white dark:bg-[#171717]">
            <div className="p-6 md:p-8 max-w-4xl mx-auto w-full">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">LLM Connections</h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Manage API keys for your LLM providers</p>
                    </div>
                </div>

                {/* ── Add New Connection Form ── */}
                <div className="mt-8 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Add New Connection</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {/* Provider */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Provider</label>
                            <select
                                value={provider}
                                onChange={(e) => setProvider(e.target.value)}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
                            >
                                {PROVIDERS.map((p) => (
                                    <option key={p.value} value={p.value}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Alias */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Alias</label>
                            <input
                                type="text"
                                value={alias}
                                onChange={(e) => setAlias(e.target.value)}
                                placeholder="e.g. production-key"
                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-slate-400"
                            />
                        </div>

                        {/* API Key */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">API Key</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-slate-400"
                            />
                        </div>
                    </div>

                    {/* Error / Success */}
                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
                    )}
                    {successMsg && (
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">{successMsg}</p>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving || !apiKey.trim()}
                        className="px-6 py-2.5 bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white hover:opacity-90 text-sm font-semibold rounded-lg disabled:opacity-50 transition-all shadow-sm focus:outline-none focus:ring-0 save-btn"
                    >
                        {saving ? "Saving..." : "Save Connection"}
                    </button>
                </div>

                {/* ── Available Connections ── */}
                <div className="mt-8">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Available Connections</h3>

                    {llmConnections.length === 0 ? (
                        <div className="bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                </svg>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">No connections configured yet. Add your first LLM provider above.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {llmConnections.map((conn) => (
                                <div
                                    key={conn.id}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-start justify-between group hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase">
                                                {conn.provider.slice(0, 2)}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{conn.alias || conn.provider}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{conn.provider}</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-1">{conn.api_key_masked}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(conn.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Delete connection"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
