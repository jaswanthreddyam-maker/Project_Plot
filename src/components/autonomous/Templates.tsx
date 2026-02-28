"use client";

import { useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { API_BASE } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

interface TemplateModel {
    id: number;
    name: string;
    description: string;
    icon_name: string;
    required_keys: string[];
    workflow_config: {
        agentConfig: any[];
        taskConfig: any[];
    };
}

interface VaultKey {
    id: string;
    key_name: string;
    masked_value: string;
}

export default function Templates() {
    const { setAgentConfig, setTaskConfig, setActiveAmpRoute } = useUIStore();

    const [templates, setTemplates] = useState<TemplateModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedTemplate, setSelectedTemplate] = useState<TemplateModel | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Vault State
    const [vaultKeys, setVaultKeys] = useState<VaultKey[]>([]);
    const [missingKeys, setMissingKeys] = useState<string[]>([]);

    // Key Input State
    const [inputValues, setInputValues] = useState<Record<string, string>>({});
    const [isSavingKey, setIsSavingKey] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Fetch Templates
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/templates`);
                if (res.ok) {
                    const data = await res.json();
                    setTemplates(data);
                }
            } catch (err) {
                console.error("Failed to fetch templates", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    // Show Toast Helper
    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Fetch Vault Keys
    const fetchVaultKeys = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/vault/list`);
            if (res.ok) {
                const data = await res.json();
                setVaultKeys(data);
                return data;
            }
        } catch (err) {
            console.error("Failed to fetch vault", err);
        }
        return [];
    };

    // Open Template Drawer
    const handlePreview = async (template: TemplateModel) => {
        setSelectedTemplate(template);
        setIsDrawerOpen(true);

        // Check Keys
        const keys: VaultKey[] = await fetchVaultKeys();

        const missing = template.required_keys.filter(reqKey => {
            // Check if vault has a key matching the requirement
            // e.g. "openai" matches "OPENAI_API_KEY"
            const expectedKeyName = `${reqKey.toUpperCase()}_API_KEY`;
            return !keys.some(v => v.key_name === reqKey || v.key_name === expectedKeyName);
        });

        setMissingKeys(missing);

        // Reset inputs
        const initialInputs: Record<string, string> = {};
        missing.forEach(m => initialInputs[m] = "");
        setInputValues(initialInputs);
    };

    // Save Key to Vault
    const saveKeyToVault = async (reqKey: string) => {
        const val = inputValues[reqKey];
        if (!val) {
            showToast("Key is empty!");
            return;
        }

        setIsSavingKey(true);
        const keyName = `${reqKey.toUpperCase()}_API_KEY`;
        const payload = {
            key_name: keyName,
            value: val,
            category: "LLM"
        };

        try {
            const res = await fetch(`${API_BASE}/api/vault/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast(`Success: ${keyName} saved securely.`);
                const newKeys = await fetchVaultKeys();

                // Recalculate missing
                if (selectedTemplate) {
                    const missing = selectedTemplate.required_keys.filter(rk => {
                        const expected = `${rk.toUpperCase()}_API_KEY`;
                        return !newKeys.some((v: VaultKey) => v.key_name === rk || v.key_name === expected);
                    });
                    setMissingKeys(missing);
                }
            } else {
                const err = await res.json();
                showToast(`Error: ${err.detail || "Failed to save key."}`);
            }
        } catch (err) {
            showToast("Network Error: Could not save key.");
        } finally {
            setIsSavingKey(false);
        }
    };

    // Deploy to Workspace
    const handleDeploy = () => {
        if (!selectedTemplate) return;

        if (missingKeys.length > 0) {
            showToast("Mawa, ee template ki require keys kavali. Fill cheyi.");
            return;
        }

        const config = selectedTemplate.workflow_config;
        if (config.agentConfig) setAgentConfig(config.agentConfig);
        if (config.taskConfig) setTaskConfig(config.taskConfig);

        setIsDrawerOpen(false);
        showToast("Success: Template agents deployed to workspace.");

        // Redirect to Workspace
        setTimeout(() => {
            setActiveAmpRoute("crew-studio");
        }, 500);
    };

    return (
        <div className="flex-1 h-full bg-slate-50 relative overflow-hidden flex flex-col items-center">

            {/* Header */}
            <div className="w-full max-w-5xl px-8 pt-12 pb-8 text-center">
                <h1 className="text-3xl font-extrabold text-black tracking-tight font-sans">Template Library</h1>
                <p className="text-slate-600 mt-2 font-medium">Choose a pre-built agentic workflow to accelerate your workspace.</p>
            </div>

            {/* Grid Area */}
            <div className="flex-1 w-full max-w-5xl px-8 pb-12 overflow-y-auto scrollbar-thin">
                {isLoading ? (
                    <div className="w-full py-20 flex justify-center text-slate-500 font-medium">Loading workflows...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                        {templates.map(template => {
                            const IconComponent = (LucideIcons as any)[template.icon_name] || LucideIcons.LayoutTemplate;

                            return (
                                <motion.div
                                    key={template.id}
                                    whileHover={{ y: -4, boxShadow: "0px 10px 30px rgba(0,0,0,0.1)" }}
                                    className="bg-white border border-black rounded-2xl p-6 flex flex-col justify-between h-72 transition-all outline-none ring-0"
                                >
                                    <div>
                                        <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center mb-5">
                                            <IconComponent size={24} strokeWidth={2} />
                                        </div>
                                        <h3 className="font-bold text-lg text-black mb-2">{template.name}</h3>
                                        <p className="text-sm text-slate-600 leading-relaxed font-medium line-clamp-3">
                                            {template.description}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handlePreview(template)}
                                        className="w-full mt-6 py-2.5 bg-black text-white rounded-2xl font-bold text-sm tracking-wide transition-colors hover:bg-slate-800 outline-none ring-0"
                                    >
                                        Preview Template
                                    </button>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Drawer */}
            <AnimatePresence>
                {isDrawerOpen && selectedTemplate && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsDrawerOpen(false)}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", stiffness: 250, damping: 30 }}
                            className="absolute right-0 top-0 bottom-0 w-[450px] bg-white border-l border-black p-6 z-50 flex flex-col shadow-2xl overflow-y-auto"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex gap-3 items-center">
                                    <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center">
                                        {(() => {
                                            const IconC = (LucideIcons as any)[selectedTemplate.icon_name] || LucideIcons.LayoutTemplate;
                                            return <IconC size={20} />;
                                        })()}
                                    </div>
                                    <h2 className="text-xl font-bold text-black">{selectedTemplate.name}</h2>
                                </div>
                                <button onClick={() => setIsDrawerOpen(false)} className="text-black hover:bg-slate-100 p-2 rounded-full transition-colors outline-none ring-0">
                                    <LucideIcons.X size={20} />
                                </button>
                            </div>

                            <p className="text-sm text-slate-600 font-medium leading-relaxed mb-8">
                                {selectedTemplate.description}
                            </p>

                            {/* Architecture */}
                            <div className="mb-8">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Agents Involved</h4>
                                <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-slate-50">
                                    {selectedTemplate.workflow_config?.agentConfig?.map((agent: any, idx) => (
                                        <div key={agent.id} className="flex items-center gap-3">
                                            <LucideIcons.Bot size={16} className="text-slate-600" />
                                            <span className="text-sm font-bold text-black">{agent.role}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Credentials */}
                            <div className="flex-1 mb-8">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">API Vault Verification</h4>

                                {selectedTemplate.required_keys.length === 0 ? (
                                    <div className="text-sm text-slate-500 font-medium">No External Keys Required.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {selectedTemplate.required_keys.map(reqKey => {
                                            const isMissing = missingKeys.includes(reqKey);

                                            if (!isMissing) {
                                                return (
                                                    <div key={reqKey} className="flex items-center justify-between p-3 border border-emerald-200 bg-emerald-50 rounded-xl">
                                                        <div className="flex items-center gap-2">
                                                            <LucideIcons.CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
                                                            <span className="text-sm font-bold text-emerald-800 uppercase">{reqKey} Access</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">Secured</span>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div key={reqKey} className="p-4 border border-red-200 bg-red-50 rounded-xl space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <LucideIcons.AlertCircle className="text-red-500 shrink-0" size={16} />
                                                        <span className="text-sm font-bold text-red-800 uppercase">{reqKey} Key Missing</span>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <input
                                                            type="password"
                                                            placeholder={`Enter ${reqKey.toUpperCase()} API Key`}
                                                            value={inputValues[reqKey] || ""}
                                                            onChange={e => setInputValues({ ...inputValues, [reqKey]: e.target.value })}
                                                            className="flex-1 bg-white border border-red-200 rounded-lg px-3 py-2 text-sm text-black outline-none ring-0 placeholder:text-slate-400 focus:border-red-400"
                                                        />
                                                        <button
                                                            onClick={() => saveKeyToVault(reqKey)}
                                                            disabled={isSavingKey}
                                                            className="px-4 bg-black text-white rounded-lg text-sm font-bold outline-none ring-0 hover:bg-slate-800 disabled:opacity-50"
                                                        >
                                                            {isSavingKey ? "Saving..." : "Save"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Action Button */}
                            <button
                                onClick={handleDeploy}
                                disabled={missingKeys.length > 0}
                                className={`w-full py-4 rounded-2xl font-bold text-center tracking-wide transition-all outline-none ring-0 shadow-sm
                                    ${missingKeys.length > 0 ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-black text-white hover:bg-slate-800 hover:shadow-md"}
                                `}
                            >
                                Use This Template
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Toasts */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: 50, x: "-50%" }}
                        className="fixed bottom-10 left-1/2 bg-black text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 border border-slate-800"
                    >
                        <LucideIcons.Info size={16} />
                        <span className="text-sm font-bold">{toastMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
