"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useUIStore } from "@/store/uiStore";

interface ScheduledFlow {
    id: string;
    crew_name: string;
    cron_schedule: string;
    is_active: boolean;
    created_at: string;
}

export default function Automations() {
    const { agentConfig, taskConfig, activeKnowledgeSources } = useUIStore();

    const [automations, setAutomations] = useState<ScheduledFlow[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [crewName, setCrewName] = useState("Daily Research Crew");
    const [cronSchedule, setCronSchedule] = useState("Every Hour");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const presetSchedules = [
        "Every 1 Minute",
        "Every Hour",
        "Daily at 9 AM"
    ];

    useEffect(() => {
        fetchAutomations();
    }, []);

    const fetchAutomations = async () => {
        try {
            setLoading(true);
            const res = await fetch("http://localhost:8000/api/automations");
            if (res.ok) {
                const data = await res.json();
                setAutomations(data);
            }
        } catch (error) {
            console.error("Failed to fetch automations:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Package the current store state into a deployable blueprint
            const payload = {
                objective: `Scheduled automation: ${crewName}`,
                agents: agentConfig,
                tasks: taskConfig,
                knowledge_sources: activeKnowledgeSources
            };

            const res = await fetch("http://localhost:8000/api/automations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    crew_name: crewName,
                    cron_schedule: cronSchedule,
                    payload
                })
            });

            if (res.ok) {
                setShowModal(false);
                fetchAutomations();
                setCrewName("Daily Research Crew");
                setCronSchedule("Every Hour");
                alert("Schedule Created Successfully!");
            } else {
                let errMsg = "Failed to create automation.";
                try {
                    const errData = await res.json();
                    errMsg = errData.detail || errMsg;
                } catch (e) { }
                alert(`Error: ${errMsg}`);
            }
        } catch (error: any) {
            console.error(error);
            alert(`Network Error: ${error.message || "Failed to reach backend."}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleActive = async (id: string, currentStatus: boolean) => {
        // Optimistic UI update
        setAutomations(automations.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a));
        try {
            await fetch(`http://localhost:8000/api/automations/${id}/toggle`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: !currentStatus })
            });
        } catch (error) {
            // Revert on failure
            setAutomations(automations.map(a => a.id === id ? { ...a, is_active: currentStatus } : a));
            console.error("Failed to toggle status:", error);
        }
    };

    return (
        <div className="flex h-full w-full bg-[#111111] dark:bg-[#111111] overflow-hidden text-slate-200">
            <div className="flex-1 flex flex-col h-full overflow-y-auto w-full p-8 max-w-6xl mx-auto">

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Automations & Schedules</h2>
                        <p className="text-sm text-slate-400">Run Plot autonomously using Celery Beat infrastructure.</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-5 py-2.5 rounded-full font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.3)] border border-indigo-500/50"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        Create Schedule
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                    </div>
                ) : automations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-500 space-y-4 border border-slate-800 border-dashed rounded-2xl bg-[#171717]">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-600">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <p>No automations scheduled yet. Create one to run workflows continuously.</p>
                    </div>
                ) : (
                    <div className="bg-[#171717] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#1a1a1a] border-b border-slate-800 text-slate-400">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Crew Name</th>
                                    <th className="px-6 py-4 font-medium">Schedule (Cron)</th>
                                    <th className="px-6 py-4 font-medium">Created At</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {automations.map((automation) => (
                                    <tr key={automation.id} className="hover:bg-[#1a1a1a]/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-white flex items-center gap-2">
                                                {automation.crew_name}
                                            </div>
                                            <div className="text-xs font-mono text-slate-500 mt-1">{automation.id}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 font-medium text-xs border border-indigo-500/20">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <polyline points="12 6 12 12 16 14" />
                                                </svg>
                                                {automation.cron_schedule}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400">
                                            {format(new Date(automation.created_at), "MMM d, yyyy HH:mm")}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleActive(automation.id, automation.is_active)}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${automation.is_active ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                            >
                                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${automation.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Creation Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#171717] border border-slate-700 rounded-2xl p-6 w-[480px] shadow-2xl relative">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>

                        <h3 className="text-xl font-bold text-white mb-2">Schedule Flow</h3>
                        <p className="text-sm text-slate-400 mb-6">
                            This will capture your <span className="text-indigo-400">currently configured Agents and Tasks</span> from the builder and schedule them to run repeatedly.
                        </p>

                        <form onSubmit={handleCreateSchedule} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Configuration Name</label>
                                <input
                                    type="text"
                                    value={crewName}
                                    onChange={e => setCrewName(e.target.value)}
                                    className="w-full bg-[#111] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Execution Schedule</label>
                                <select
                                    value={cronSchedule}
                                    onChange={e => setCronSchedule(e.target.value)}
                                    className="w-full bg-[#111] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                >
                                    {presetSchedules.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-white text-black font-semibold rounded-lg px-4 py-2 hover:bg-slate-200 transition-colors disabled:opacity-50"
                                >
                                    {isSubmitting ? "Deploying Schedule..." : "Confirm Schedule"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
