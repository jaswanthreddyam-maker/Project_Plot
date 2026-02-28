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
        total_tokens: number;
        total_agents: number;
        total_tasks: number;
    };
    token_chart: { date: string, tokens: number }[];
}

const MOCK_DATA: UsageData = {
    summary: {
        total_tokens: 1245000,
        total_agents: 12,
        total_tasks: 45
    },
    token_chart: [
        { date: "Mon", tokens: 120000 },
        { date: "Tue", tokens: 180000 },
        { date: "Wed", tokens: 250000 },
        { date: "Thu", tokens: 190000 },
        { date: "Fri", tokens: 280000 },
        { date: "Sat", tokens: 150000 },
        { date: "Sun", tokens: 75000 },
    ]
};

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
        // Simulate network request to load mock data
        const loadDelay = setTimeout(() => {
            setData(MOCK_DATA);
            setLoading(false);
        }, 800);
        return () => clearTimeout(loadDelay);
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
                            <p className="text-xs font-bold uppercase tracking-widest">Total Tokens</p>
                            <Activity size={16} />
                        </div>
                        <h3 className="text-4xl font-bold text-black dark:text-white">{(data.summary.total_tokens / 1000000).toFixed(2)}M</h3>
                        <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase tracking-tighter">Tokens Processed</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-2xl p-6 transition-all hover:border-black dark:hover:border-white">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                            <p className="text-xs font-bold uppercase tracking-widest">Total Agents</p>
                            <Activity size={16} />
                        </div>
                        <h3 className="text-4xl font-bold text-black dark:text-white">{data.summary.total_agents}</h3>
                        <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase tracking-tighter">Active Agents</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-2xl p-6 transition-all hover:border-black dark:hover:border-white">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                            <p className="text-xs font-bold uppercase tracking-widest">Total Tasks</p>
                            <Activity size={16} />
                        </div>
                        <h3 className="text-4xl font-bold text-black dark:text-white">{data.summary.total_tasks}</h3>
                        <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase tracking-tighter">Completed Tasks</p>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 mb-12">

                    {/* Token Consumption Chart */}
                    <div className="bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden ring-0 outline-none transition-all hover:shadow-md max-w-4xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold text-black dark:text-white uppercase tracking-widest font-mono">Token Spend (Last 7 Days)</h3>
                        </div>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.token_chart}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#000", border: "none", borderRadius: "8px", fontSize: "12px" }}
                                        itemStyle={{ color: "#fff" }}
                                        wrapperClassName="outline-none ring-0 border-none"
                                    />
                                    <Line type="monotone" dataKey="tokens" stroke="#000" strokeWidth={3} dot={{ r: 4, fill: "#000", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
