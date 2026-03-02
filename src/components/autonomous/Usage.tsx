"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { motion } from "framer-motion";
import { Activity, DollarSign, ShieldCheck, TrendingUp, BarChart3, Users, Wrench } from "lucide-react";
import { API_BASE, fetchWithTimeout, readErrorMessage } from "@/lib/api";

/* ═══════════════════════════════════════════════════════════════
 * Usage Page — Live Analytics & Cost Tracking
 * ═══════════════════════════════════════════════════════════════ */

interface UsageMetrics {
    summary: {
        total_cost: number;
        total_agents: number;
        total_tools: number;
        success_rate: number;
        total_runs: number;
    };
    token_chart: { date: string, tokens: number }[];
    task_chart: { date: string, tasks: number }[];
}

const SkeletonLoader = () => (
    <div className="animate-pulse space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-3xl" />
            ))}
        </div>
        <div className="h-96 bg-slate-100 dark:bg-slate-800 rounded-3xl" />
    </div>
);

export function UsagePage() {
    const router = useRouter();
    const [metrics, setMetrics] = useState<UsageMetrics>({
        summary: {
            total_cost: 0,
            total_agents: 0,
            total_tools: 0,
            success_rate: 0,
            total_runs: 0
        },
        token_chart: [],
        task_chart: []
    });
    const [loading, setLoading] = useState(true);
    const [offlineError, setOfflineError] = useState(false);
    const [offlineMessage, setOfflineMessage] = useState("Network error connecting to analytics engine.");

    const fetchUsage = useCallback(async () => {
        setOfflineError(false);
        setOfflineMessage("Network error connecting to analytics engine.");
        try {
            // Retrieve token from localStorage
            let token = "";
            if (typeof window !== "undefined") {
                token = localStorage.getItem("plot_auth_token") || "";
            }

            const res = await fetchWithTimeout(`${API_BASE}/api/analytics/usage`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.status === 401) {
                router.push("/login");
                return;
            }

            if (!res.ok) {
                const detail = await readErrorMessage(
                    res,
                    `Failed to load analytics (HTTP ${res.status}).`
                );
                setOfflineMessage(detail);
                setOfflineError(true);
                return;
            }

            const json = await res.json();

            // Soft-merge the incoming data with our default bulletproof state
            setMetrics({
                summary: {
                    total_cost: json?.summary?.total_cost || 0,
                    total_agents: json?.summary?.total_agents || 0,
                    total_tools: json?.summary?.total_tools || 0,
                    success_rate: json?.summary?.success_rate || 0,
                    total_runs: json?.summary?.total_runs || 0
                },
                token_chart: json?.token_chart || [],
                task_chart: json?.task_chart || []
            });

        } catch (err: unknown) {
            console.error(err);
            setOfflineMessage(
                err instanceof Error ? err.message : "Network error connecting to analytics engine."
            );
            setOfflineError(true); // Actual network connection failure
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchUsage();
    }, [fetchUsage]);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#111111] overflow-y-auto w-full px-6 py-8">
                <div className="max-w-6xl mx-auto w-full">
                    <SkeletonLoader />
                </div>
            </div>
        );
    }

    if (offlineError) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 text-center bg-white dark:bg-[#111111]">
                <div className="max-w-sm">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Activity size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Analytics Offline</h3>
                    <p className="text-sm text-slate-500 mb-6">{offlineMessage}</p>
                    <button onClick={() => { setLoading(true); fetchUsage(); }} className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold">Try Again</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#111111] overflow-y-auto w-full px-6 py-8">
            <div className="max-w-6xl mx-auto w-full">

                {/* Header */}
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h2 className="text-3xl font-bold text-black dark:text-white tracking-tight flex items-center gap-3">
                            <Activity size={32} /> Usage & Analytics
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Real-time token consumption and cost tracking for your autonomous crew.</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 shadow-sm animate-pulse-slow">
                        <ShieldCheck size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Live Tracking</span>
                    </div>
                </div>

                {/* Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-3xl p-6 hover:border-black dark:hover:border-white transition-all shadow-sm group">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
                            <p className="text-xs font-black uppercase tracking-widest font-mono">Total Spend</p>
                            <DollarSign size={18} className="group-hover:scale-110 transition-transform" />
                        </div>
                        <h3 className="text-4xl font-black text-black dark:text-white tracking-tighter">${metrics?.summary?.total_cost?.toFixed(2) || "0.00"}</h3>
                        <p className="text-[10px] text-slate-400 mt-3 font-mono uppercase tracking-widest">USD (Estimated Cost)</p>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-3xl p-6 hover:border-black dark:hover:border-white transition-all shadow-sm group">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
                            <p className="text-xs font-black uppercase tracking-widest font-mono">Active Agents</p>
                            <Users size={18} className="group-hover:scale-110 transition-transform" />
                        </div>
                        <h3 className="text-4xl font-black text-black dark:text-white tracking-tighter">{metrics?.summary?.total_agents || 0}</h3>
                        <p className="text-[10px] text-slate-400 mt-3 font-mono uppercase tracking-widest">Across Current User</p>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-3xl p-6 hover:border-black dark:hover:border-white transition-all shadow-sm group">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
                            <p className="text-xs font-black uppercase tracking-widest font-mono">Success Rate</p>
                            <TrendingUp size={18} className="group-hover:scale-110 transition-transform" />
                        </div>
                        <h3 className="text-4xl font-black text-black dark:text-white tracking-tighter">{metrics?.summary?.success_rate || 0}%</h3>
                        <p className="text-[10px] text-slate-400 mt-3 font-mono uppercase tracking-widest">Execution Health</p>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-3xl p-6 hover:border-black dark:hover:border-white transition-all shadow-sm group">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
                            <p className="text-xs font-black uppercase tracking-widest font-mono">Tool Count</p>
                            <Wrench size={18} className="group-hover:scale-110 transition-transform" />
                        </div>
                        <h3 className="text-4xl font-black text-black dark:text-white tracking-tighter">{metrics?.summary?.total_tools || 0}</h3>
                        <p className="text-[10px] text-slate-400 mt-3 font-mono uppercase tracking-widest">Nango Integrations</p>
                    </motion.div>
                </div>

                {/* Token Consumption Chart */}
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-2xl overflow-hidden ring-0 outline-none mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-sm font-black text-black dark:text-white uppercase tracking-[0.2em] font-mono">Consumption Velocity</h3>
                            <p className="text-xs text-slate-500 mt-1">Token processed (Prompt + Completion)</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-black dark:bg-white" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Overall Activity</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-96 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics?.token_chart || []}>
                                <defs>
                                    <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#000" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#000" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="tokenGradientDark" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#fff" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#fff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#94a3b8"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(str) => {
                                        if (!str) return "";
                                        const date = new Date(str);
                                        return date.toLocaleDateString('en-US', { weekday: 'short' });
                                    }}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `${val / 1000}k`}
                                />
                                <Tooltip
                                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                                    contentStyle={{
                                        backgroundColor: "#000",
                                        border: "none",
                                        borderRadius: "16px",
                                        fontSize: "12px",
                                        padding: "12px 16px",
                                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
                                    }}
                                    itemStyle={{ color: "#fff", fontWeight: "bold" }}
                                    labelStyle={{ color: "#64748b", fontWeight: "bold", marginBottom: "4px" }}
                                    wrapperClassName="outline-none ring-0 border-none"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="tokens"
                                    stroke="currentColor"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#tokenGradient)"
                                    className="text-black dark:text-white"
                                    animationDuration={2000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                <div className="flex items-center justify-center gap-2 py-8 border-t border-slate-100 dark:border-slate-800 opacity-50">
                    <BarChart3 size={14} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Enterprise Analytics Enabled</span>
                </div>
            </div>
        </div>
    );
}
