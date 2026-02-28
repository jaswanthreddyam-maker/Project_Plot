"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/* ═══════════════════════════════════════════════════════════════
 * Usage Page — Mock Data Visualizations
 * ═══════════════════════════════════════════════════════════════ */

const MOCK_TOKEN_DATA = [
    { date: "Mon", tokens: 12000 },
    { date: "Tue", tokens: 18000 },
    { date: "Wed", tokens: 15000 },
    { date: "Thu", tokens: 24000 },
    { date: "Fri", tokens: 21000 },
    { date: "Sat", tokens: 9000 },
    { date: "Sun", tokens: 11000 },
];

const MOCK_TASK_DATA = [
    { date: "Mon", tasks: 45 },
    { date: "Tue", tasks: 62 },
    { date: "Wed", tasks: 58 },
    { date: "Thu", tasks: 89 },
    { date: "Fri", tasks: 75 },
    { date: "Sat", tasks: 22 },
    { date: "Sun", tasks: 30 },
];

export function UsagePage() {
    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#171717] overflow-y-auto w-full px-6 py-8 autonomous-theme">
            <div className="max-w-6xl mx-auto w-full">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                            Usage & Analytics
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-2 py-0.5 rounded uppercase tracking-wider font-semibold">Soon</span>
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track token consumption and task throughput.</p>
                    </div>
                </div>

                {/* Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Agents</p>
                        <h3 className="text-4xl font-bold text-slate-900 dark:text-white mt-2">12</h3>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">Tools Configured</p>
                        <h3 className="text-4xl font-bold text-slate-900 dark:text-white mt-2">8</h3>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">Successful Runs</p>
                        <h3 className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">381</h3>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Token Consumption Chart */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 font-mono">Token Consumption (7 Days)</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={MOCK_TOKEN_DATA}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#f8fafc" }}
                                        itemStyle={{ color: "#a78bfa" }}
                                    />
                                    <Line type="monotone" dataKey="tokens" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Task Throughput Chart */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 font-mono">Task Throughput (7 Days)</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={MOCK_TASK_DATA}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#f8fafc" }}
                                        itemStyle={{ color: "#34d399" }}
                                    />
                                    <Line type="monotone" dataKey="tasks" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
