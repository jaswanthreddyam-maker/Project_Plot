"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";

interface EnvVariable {
    id: string;
    key: string;
    value_masked: string;
    created_at: string;
}

export default function EnvVariables() {
    const [variables, setVariables] = useState<EnvVariable[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [envKey, setEnvKey] = useState("");
    const [envValue, setEnvValue] = useState("");

    const fetchVariables = async () => {
        try {
            setLoading(true);
            const res = await fetch("http://localhost:8000/api/settings/env");
            if (res.ok) {
                const data = await res.json();
                setVariables(data.variables || []);
            }
        } catch (err) {
            console.error("Failed to fetch environment variables", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVariables();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!envKey.trim() || !envValue.trim()) return;

        try {
            setIsSubmitting(true);
            const res = await fetch("http://localhost:8000/api/settings/env", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: envKey.trim(), value: envValue.trim() })
            });

            if (res.ok) {
                setEnvKey("");
                setEnvValue("");
                fetchVariables();
                alert("Environment variable saved successfully.");
            } else {
                let errText = "Failed to save variable";
                try {
                    const errData = await res.json();
                    errText = errData.detail || errText;
                } catch (e) { }
                alert(`Error: ${errText}`);
            }
        } catch (err: any) {
            console.error("Fetch error:", err);
            alert(`Network Error: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (key: string) => {
        if (!confirm(`Are you sure you want to delete ${key}?`)) return;
        try {
            const res = await fetch(`http://localhost:8000/api/settings/env/${encodeURIComponent(key)}`, {
                method: "DELETE"
            });
            if (res.ok) {
                fetchVariables();
            } else {
                alert("Failed to delete variable.");
            }
        } catch (err: any) {
            alert(`Network Error: ${err.message}`);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#171717] p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full space-y-8">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Environment Variables</h2>
                    <p className="text-slate-400 text-sm">
                        Store global API keys and configuration parameters required by your autonomous workflows. These variables are securely loaded into the execution context before any tools or agents run.
                    </p>
                </div>

                {/* Add New Variable Form */}
                <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-slate-200 mb-4 uppercase tracking-wider">Add New Variable</h3>
                    <form onSubmit={handleSave} className="flex gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-medium text-slate-400">Key Identifier</label>
                            <input
                                type="text"
                                value={envKey}
                                onChange={(e) => setEnvKey(e.target.value)}
                                placeholder="e.g., SERPER_API_KEY"
                                className="w-full bg-[#121212] border border-[#262626] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                                required
                            />
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-medium text-slate-400">Secure Value</label>
                            <input
                                type="password"
                                value={envValue}
                                onChange={(e) => setEnvValue(e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-[#121212] border border-[#262626] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting || !envKey.trim() || !envValue.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-[42px]"
                        >
                            {isSubmitting ? "Saving..." : "Save Variable"}
                        </button>
                    </form>
                </div>

                {/* Vault List */}
                <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#262626] flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-200">Vault Contents</h3>
                        <button onClick={fetchVariables} className="text-slate-400 hover:text-white" title="Refresh Vault">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-0">
                        {loading ? (
                            <div className="p-8 text-center text-sm text-slate-500 animate-pulse">Loading secure vault...</div>
                        ) : variables.length === 0 ? (
                            <div className="p-8 text-center text-sm text-slate-500">No global variables configured. Add your first key above.</div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-[#262626] bg-[#121212]">
                                        <th className="px-6 py-3 font-medium text-slate-400 w-1/3">Key</th>
                                        <th className="px-6 py-3 font-medium text-slate-400 w-1/3">Masked Value</th>
                                        <th className="px-6 py-3 font-medium text-slate-400">Created</th>
                                        <th className="px-6 py-3 font-medium text-slate-400 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#262626]">
                                    {variables.map((v) => (
                                        <tr key={v.id} className="hover:bg-[#262626]/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-emerald-400">{v.key}</td>
                                            <td className="px-6 py-4 font-mono text-slate-300">{v.value_masked}</td>
                                            <td className="px-6 py-4 text-slate-500 text-xs">
                                                {format(new Date(v.created_at), "MMM d, yyyy HH:mm")}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(v.key)}
                                                    className="text-red-400 hover:text-red-300 text-xs font-semibold px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
