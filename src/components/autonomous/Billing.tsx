"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, ExternalLink, Zap, ShieldCheck, PieChart, ArrowRight } from "lucide-react";
import { API_BASE, fetchWithTimeout, readErrorMessage } from "@/lib/api";

const PLANS = [
    {
        id: "price_1QxZ2kK3k...", // Real Stripe Price ID would go here
        name: "Metered Scale",
        description: "Pay only for what you use. Perfect for growing autonomous squads.",
        features: [
            "Unlimited Agents & Tasks",
            "Real-time usage tracking",
            "Nango OAuth for all tools",
            "Priority support",
            "$0.01 per 1,000 tokens",
        ],
        price: "$0",
        suffix: "/ base + usage",
        buttonText: "Upgrade to Scale",
        popular: true,
    }
];

export function BillingPage() {
    const [status, setStatus] = useState<{ status: string; customer_id: string | null; has_item: boolean } | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        setError(null);
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/billing/status`);
            if (!res.ok) {
                const detail = await readErrorMessage(
                    res,
                    `Failed to fetch billing status (HTTP ${res.status}).`
                );
                throw new Error(detail);
            }
            const data = await res.json();
            setStatus(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to fetch billing status.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleUpgrade = async (planId: string) => {
        setActionLoading(true);
        setError(null);
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/billing/create-checkout-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan_id: planId })
            });
            if (!res.ok) {
                const detail = await readErrorMessage(
                    res,
                    `Failed to start checkout (HTTP ${res.status}).`
                );
                throw new Error(detail);
            }

            const data = (await res.json()) as { url?: string };
            if (!data.url) {
                throw new Error("Checkout URL missing in response.");
            }
            window.location.href = data.url;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Upgrade failed.");
        } finally {
            setActionLoading(false);
        }
    };

    const handlePortal = async () => {
        setActionLoading(true);
        setError(null);
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/billing/create-portal-session`, {
                method: "POST"
            });
            if (!res.ok) {
                const detail = await readErrorMessage(
                    res,
                    `Failed to open billing portal (HTTP ${res.status}).`
                );
                throw new Error(detail);
            }

            const data = (await res.json()) as { url?: string };
            if (!data.url) {
                throw new Error("Portal URL missing in response.");
            }
            window.location.href = data.url;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Portal access failed.");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#111111]">
                <div className="w-12 h-12 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const isActive = status?.status === "active";

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#111111] overflow-y-auto w-full px-6 py-12">
            <div className="max-w-5xl mx-auto w-full">

                {/* Header */}
                <div className="mb-12">
                    <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter flex items-center gap-4 mb-4">
                        <CreditCard size={40} strokeWidth={2.5} /> Subscription
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                        Manage your billing, plans, and metered usage settings.
                        Plot AI uses a fair consumption-based pricing model.
                    </p>
                </div>
                {error && (
                    <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                )}

                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                    <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-3xl p-8 transition-all hover:shadow-xl hover:-translate-y-1">
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6">
                            <ShieldCheck size={20} />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 font-mono">Current Plan</p>
                        <h3 className="text-2xl font-black text-black dark:text-white uppercase">{isActive ? "Metered Scale" : "Free Trial"}</h3>
                    </div>

                    <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-3xl p-8 transition-all hover:shadow-xl hover:-translate-y-1">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                            <PieChart size={20} />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 font-mono">Usage Model</p>
                        <h3 className="text-2xl font-black text-black dark:text-white uppercase">Consumption</h3>
                    </div>

                    <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-3xl p-8 transition-all hover:shadow-xl hover:-translate-y-1">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-6">
                            <Zap size={20} />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 font-mono">Billing Cycle</p>
                        <h3 className="text-2xl font-black text-black dark:text-white uppercase">Monthly</h3>
                    </div>
                </div>

                {/* Plan Selection */}
                {isActive ? (
                    <div className="bg-slate-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] p-12 flex flex-col md:flex-row items-center justify-between gap-12 shadow-2xl">
                        <div className="flex-1">
                            <div className="inline-flex items-center gap-2 px-4 py-1 bg-emerald-500/20 text-emerald-400 dark:text-emerald-600 rounded-full border border-emerald-500/20 mb-6">
                                <CheckCircle2 size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Active Subscription</span>
                            </div>
                            <h3 className="text-4xl font-black tracking-tighter mb-4">You&apos;re on the Scale Plan</h3>
                            <p className="text-slate-400 dark:text-slate-500 leading-relaxed mb-8 max-w-md text-lg">
                                Your account is enabled for unlimited autonomous runs. Usage is reported hourly to Stripe.
                            </p>
                            <button
                                onClick={handlePortal}
                                disabled={actionLoading}
                                className="px-8 py-4 bg-white dark:bg-black text-black dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-3 hover:scale-105 transition-all disabled:opacity-50"
                            >
                                {actionLoading ? <div className="w-4 h-4 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" /> : <ExternalLink size={18} />}
                                Customer Portal
                            </button>
                        </div>
                        <div className="w-full md:w-80 bg-white/5 dark:bg-black/5 rounded-3xl p-8 border border-white/10 dark:border-black/10 backdrop-blur-sm">
                            <div className="space-y-4">
                                {PLANS[0].features.slice(0, 4).map((f, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm font-medium">
                                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                        <span>{f}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-1 max-w-2xl mx-auto">
                        {PLANS.map((plan) => (
                            <motion.div
                                key={plan.id}
                                whileHover={{ scale: 1.02 }}
                                className="relative bg-white dark:bg-black border-2 border-slate-200 dark:border-slate-800 rounded-[3rem] p-12 shadow-xl overflow-hidden"
                            >
                                <div className="absolute top-8 right-8">
                                    <div className="px-4 py-1 bg-black dark:bg-white text-white dark:text-black rounded-full text-[10px] font-black uppercase tracking-widest">
                                        Popular
                                    </div>
                                </div>
                                <h3 className="text-4xl font-black text-black dark:text-white mb-2 uppercase tracking-tight">{plan.name}</h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-10 text-lg leading-relaxed">{plan.description}</p>

                                <div className="flex items-baseline gap-2 mb-10">
                                    <span className="text-6xl font-black text-black dark:text-white tracking-tighter">{plan.price}</span>
                                    <span className="text-slate-400 font-bold">{plan.suffix}</span>
                                </div>

                                <div className="space-y-5 mb-12">
                                    {plan.features.map((feature, i) => (
                                        <div key={i} className="flex items-center gap-4 text-slate-700 dark:text-slate-300 font-semibold">
                                            <CheckCircle2 size={24} className="text-black dark:text-white shrink-0" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => handleUpgrade(plan.id)}
                                    disabled={actionLoading}
                                    className="w-full py-6 bg-black dark:bg-white text-white dark:text-black rounded-[2rem] font-black text-lg uppercase tracking-widest hover:shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {actionLoading ? <div className="w-5 h-5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" /> : <ArrowRight size={20} />}
                                    {plan.buttonText}
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* FAQ / Trust Segment */}
                <div className="mt-24 grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-slate-100 dark:border-slate-800 pt-16">
                    <div>
                        <h4 className="text-xl font-black text-black dark:text-white mb-4 uppercase tracking-tight">How metered billing works</h4>
                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            We track the exact number of tokens used by your agents during execution. These are synced with Stripe in real-time. You&apos;ll only be billed at the end of each monthly cycle for the volume processed.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-black dark:text-white mb-4 uppercase tracking-tight">Secure Payments</h4>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl">
                                <ShieldCheck size={14} className="text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PCI Compliant</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl">
                                <CreditCard size={14} className="text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Stripe Secured</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
