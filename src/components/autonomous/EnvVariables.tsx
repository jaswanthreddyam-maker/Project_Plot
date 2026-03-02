"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { API_BASE, fetchWithTimeout } from "@/lib/api";

interface VariableInput {
    key: string;
    value: string;
}

interface VaultVariable {
    id: string;
    key_name: string;
    category: string;
    masked_value: string;
    created_at: string;
}

export default function EnvVariables() {
    const [savedVariables, setSavedVariables] = useState<VaultVariable[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const [variables, setVariables] = useState<VariableInput[]>([{ key: "", value: "" }]);
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((message: string, type: "success" | "error") => {
        setToast({ message, type });
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
    }, []);

    const fetchVariables = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetchWithTimeout(`${API_BASE}/api/vault/list`);
            if (res.ok) {
                const data = await res.json();
                const envVariables = Array.isArray(data)
                    ? data.filter((item: VaultVariable) => item.category === "ENV")
                    : [];
                setSavedVariables(envVariables);
            }
        } catch (err) {
            console.error("Failed to fetch environment variables", err);
            showToast("Network Error: Failed to load vault variables.", "error");
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchVariables();
        return () => {
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
            }
        };
    }, [fetchVariables]);

    const updateVariableRow = (index: number, field: keyof VariableInput, value: string) => {
        setVariables((prev) =>
            prev.map((item, rowIndex) =>
                rowIndex === index ? { ...item, [field]: value } : item
            )
        );
    };

    const addVariableRow = () => {
        setVariables((prev) => [...prev, { key: "", value: "" }]);
    };

    const removeVariableRow = (index: number) => {
        setVariables((prev) => {
            if (prev.length === 1) {
                return [{ key: "", value: "" }];
            }
            return prev.filter((_, rowIndex) => rowIndex !== index);
        });
    };

    const handleSaveAll = async (e: React.FormEvent) => {
        e.preventDefault();

        const sanitized = variables.map((item) => ({
            key: item.key.trim(),
            value: item.value.trim()
        }));
        const valid = sanitized.filter((item) => item.key && item.value);
        if (valid.length === 0) {
            showToast("Add at least one key/value pair before saving.", "error");
            return;
        }

        if (valid.length !== sanitized.length) {
            showToast("Every row must include both key and value.", "error");
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await fetchWithTimeout(`${API_BASE}/api/vault/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ variables: valid })
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                setVariables([{ key: "", value: "" }]);
                await fetchVariables();
                const insertedCount = typeof data.inserted === "number" ? data.inserted : valid.length;
                showToast(`Saved ${insertedCount} variable${insertedCount === 1 ? "" : "s"} to Vault.`, "success");
            } else {
                showToast(data.detail || "Failed to save variables.", "error");
            }
        } catch (err: unknown) {
            console.error("Fetch error:", err);
            const message = err instanceof Error ? err.message : "Unknown error";
            showToast(`Network Error: ${message}`, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (keyName: string) => {
        if (!confirm(`Are you sure you want to delete ${keyName}?`)) return;
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/vault/delete/${encodeURIComponent(keyName)}`, {
                method: "DELETE"
            });
            if (res.ok) {
                await fetchVariables();
                showToast(`Deleted ${keyName}.`, "success");
            } else {
                showToast("Failed to delete variable.", "error");
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown error";
            showToast(`Network Error: ${message}`, "error");
        }
    };

    const hasAtLeastOneCompleteRow = variables.some(
        (item) => item.key.trim().length > 0 && item.value.trim().length > 0
    );
    const hasPartialRow = variables.some(
        (item) => (item.key.trim().length > 0 && item.value.trim().length === 0)
            || (item.key.trim().length === 0 && item.value.trim().length > 0)
    );

    return (
        <div className="flex flex-col h-full bg-[#171717] p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full space-y-8">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Environment Variables</h2>
                    <p className="text-slate-400 text-sm">
                        Store global API keys and configuration parameters required by your autonomous workflows. These variables are securely loaded into the execution context before any tools or agents run.
                    </p>
                </div>

                {toast && (
                    <div className={`rounded-lg border px-4 py-3 text-sm ${toast.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-red-500/10 border-red-500/30 text-red-300"
                        }`}>
                        {toast.message}
                    </div>
                )}

                {/* Bulk Add Variable Form */}
                <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-slate-200 mb-4 uppercase tracking-wider">Bulk Add Variables</h3>
                    <form onSubmit={handleSaveAll} autoComplete="off" className="space-y-4">
                        <div className="hidden" aria-hidden="true">
                            <input type="text" name="fake-username" autoComplete="username" tabIndex={-1} />
                            <input type="password" name="fake-password" autoComplete="current-password" tabIndex={-1} />
                        </div>
                        {variables.map((item, index) => (
                            <div key={`row-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Key Identifier</label>
                                    <input
                                        type="text"
                                        name={`env-key-${index}`}
                                        value={item.key}
                                        onChange={(e) => updateVariableRow(index, "key", e.target.value)}
                                        autoComplete="off"
                                        data-lpignore="true"
                                        data-1p-ignore
                                        placeholder="e.g., SERPER_API_KEY"
                                        className="w-full bg-[#121212] border border-[#262626] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Secure Value</label>
                                    <input
                                        type="password"
                                        name={`env-value-${index}`}
                                        value={item.value}
                                        onChange={(e) => updateVariableRow(index, "value", e.target.value)}
                                        autoComplete="new-password"
                                        data-lpignore="true"
                                        data-1p-ignore
                                        placeholder="sk-..."
                                        className="w-full bg-[#121212] border border-[#262626] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeVariableRow(index)}
                                    className="h-[42px] w-[42px] inline-flex items-center justify-center rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors"
                                    title="Delete row"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}

                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <button
                                type="button"
                                onClick={addVariableRow}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#2f2f2f] text-slate-200 hover:bg-[#222] transition-colors text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                Add Variable
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !hasAtLeastOneCompleteRow || hasPartialRow}
                                className="inline-flex items-center justify-center gap-2 bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white hover:opacity-90 px-6 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed h-[42px] save-btn"
                            >
                                {isSubmitting && <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />}
                                {isSubmitting ? "Saving..." : "Save All Variables"}
                            </button>
                        </div>
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
                        ) : savedVariables.length === 0 ? (
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
                                    {savedVariables.map((v) => (
                                        <tr key={v.id} className="hover:bg-[#262626]/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-emerald-400">{v.key_name}</td>
                                            <td className="px-6 py-4 font-mono text-slate-300">{v.masked_value}</td>
                                            <td className="px-6 py-4 text-slate-500 text-xs">
                                                {v.created_at ? format(new Date(v.created_at), "MMM d, yyyy HH:mm") : "--"}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(v.key_name)}
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
