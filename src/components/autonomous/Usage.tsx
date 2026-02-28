"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { motion } from "framer-motion";
import { Activity, DollarSign, Zap } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
 * Usage Page — Live Analytics & Cost Tracking
 * ═══════════════════════════════════════════════════════════════ */

interface UsageData {
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-80 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
            <div className="h-80 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
        </div>
    </div>
);

export function UsagePage() {
    const [data, setData] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const res = await fetch("http://localhost:8000/api/analytics/usage");
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error("Failed to fetch usage analytics", err);
            } finally {
                setLoading(false);
            }
        };
        fetchUsage();
    }, []);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#171717] overflow-y-auto w-full px-6 py-8 autonomous-theme">
                <div className="max-w-6xl mx-auto w-full">
                    <SkeletonLoader />
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#171717] overflow-y-auto w-full px-6 py-8 autonomous-theme">
            <div className="max-w-6xl mx-auto w-full">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-black dark:text-white tracking-tight flex items-center gap-3">
                            <Activity size={24} /> Usage & Analytics
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time token consumption and cost tracking for your autonomous crew.</p>
                    </div>
                </div>

                {/* Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-2xl p-6 transition-all hover:border-black dark:hover:border-white">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                            <p className="text-xs font-bold uppercase tracking-widest">Total Cost (USD)</p>
                            <DollarSign size={16} />
                        </div>
                        <h3 className="text-4xl font-bold text-black dark:text-white">${data.summary.total_cost.toFixed(4)}</h3>
                        <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase tracking-tighter">Aggregated live from SQLite</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-2xl p-6 transition-all hover:border-black dark:hover:border-white">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                            <p className="text-xs font-bold uppercase tracking-widest">Success Rate</p>
                            <Zap size={16} />
                        </div>
                        <h3 className="text-4xl font-bold text-black dark:text-white">{data.summary.success_rate}%</h3>
                        <div className="flex items-center gap-1.5 mt-2">
                            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                                <div className="bg-black dark:bg-white h-full" style={{ width: `${data.summary.success_rate}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-2xl p-6 transition-all hover:border-black dark:hover:border-white">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                            <p className="text-xs font-bold uppercase tracking-widest">Active Scale</p>
                            <Activity size={16} />
                        </div>
                        <h3 className="text-4xl font-bold text-black dark:text-white">{data.summary.total_agents} Agents</h3>
                        <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase tracking-tighter">{data.summary.total_runs} Total Executions</p>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">

                    {/* Token Consumption Chart */}
                    <div className="bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden ring-0 outline-none transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold text-black dark:text-white uppercase tracking-widest font-mono">Token Spend (Last 7 Days)</h3>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.token_chart}>
                                    <defs>
                                        <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#000" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#000" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#000", border: "none", borderRadius: "8px", fontSize: "12px" }}
                                        itemStyle={{ color: "#fff" }}
                                        wrapperClassName="outline-none ring-0 border-none"
                                    />
                                    <Area type="monotone" dataKey="tokens" stroke="#000" fillOpacity={1} fill="url(#tokenGradient)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Task Throughput Chart */}
                    <div className="bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden ring-0 outline-none transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold text-black dark:text-white uppercase tracking-widest font-mono">Agent Activity (Last 7 Days)</h3>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.task_chart}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#000", border: "none", borderRadius: "8px", fontSize: "12px" }}
                                        itemStyle={{ color: "#fff" }}
                                        wrapperClassName="outline-none ring-0 border-none"
                                    />
                                    <Line type="stepAfter" dataKey="tasks" stroke="#000" strokeWidth={3} dot={{ r: 4, fill: "#000", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
