"use client";

import { useState } from "react";
import { X, CheckCircle2, ExternalLink } from "lucide-react";

interface IntegrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    tool: {
        id: string;
        name: string;
        description: string;
        icon: React.ReactNode;
        connected: boolean;
    } | null;
    onConnect: () => void;
}

export default function IntegrationModal({ isOpen, onClose, tool, onConnect }: IntegrationModalProps) {
    const [activeTab, setActiveTab] = useState<"overview" | "configuration">("overview");

    if (!isOpen || !tool) return null;

    const benefits = [
        `Automate workflows between Plot and ${tool.name}`,
        `Securely sync data with enterprise-grade encryption`,
        `Enable agent-led actions directly in ${tool.name}`
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white dark:bg-[#121212] w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                            {tool.icon}
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{tool.name}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-6 border-b border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => setActiveTab("overview")}
                        className={`py-3 text-sm font-semibold relative transition-colors mr-6 ${activeTab === "overview" ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        Overview
                        {activeTab === "overview" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white rounded-full" />}
                    </button>
                    <button
                        onClick={() => setActiveTab("configuration")}
                        className={`py-3 text-sm font-semibold relative transition-colors ${activeTab === "configuration" ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        Configuration
                        {activeTab === "configuration" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white rounded-full" />}
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto min-h-[300px]">
                    {activeTab === "overview" ? (
                        <div className="space-y-6">
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                {tool.description}
                            </p>
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Capabilities</h3>
                                {benefits.map((benefit, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <CheckCircle2 size={16} className="text-slate-900 dark:text-white mt-0.5" />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{benefit}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">OAuth Authentication</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Plot uses Nango to securely manage your credentials. We never see your password, and tokens are stored with AES-256 encryption.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Connection ID</h4>
                                <div className="p-3 bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-500 truncate">
                                    plot-user-{tool.id}-primary
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex gap-3">
                    <button
                        onClick={onConnect}
                        className="flex-1 bg-black dark:bg-white text-white dark:text-black py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity border border-black dark:border-white flex items-center justify-center gap-2"
                    >
                        {tool.connected ? "Re-connect" : "Connect"}
                        <ExternalLink size={16} />
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-3 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
