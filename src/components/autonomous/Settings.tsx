"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ShieldCheck, KeyRound, Search, Code2, BrainCircuit, Trash2, ChevronDown, Database, LayoutTemplate, Moon, Sun, AlertTriangle, CheckCircle, Lock } from "lucide-react";
import { useTheme } from "next-themes";
import { API_BASE, fetchWithTimeout } from "@/lib/api";
import VaultPinModal from "./VaultPinModal";

interface VaultKey {
    id: string;
    key_name: string;
    category: string;
    masked_value: string;
}

const CATEGORIES = [
    { id: "LLM", label: "LLM Providers", icon: KeyRound, desc: "API keys for language models (OpenAI, Anthropic, Gemini, Grok)" },
    { id: "SEARCH", label: "Search Engines", icon: Search, desc: "Keys for SerperDev, Exa_search, or other search APIs" },
    { id: "DEV", label: "Development Tools", icon: Code2, desc: "Tokens for GitHub, Asana, Jira integrations" }
];

const PREDEFINED_KEYS = {
    LLM: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "XAI_API_KEY"],
    SEARCH: ["SERPER_API_KEY"],
    DEV: ["GITHUB_TOKEN", "ASANA_ACCESS_TOKEN", "JIRA_API_TOKEN"]
};

// Global Config Types
interface GlobalConfig {
    default_model: string;
    temperature: number;
    memory_enabled: boolean;
}

const MODELS = [
    { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
    { id: "gemini-1.5-pro-latest", name: "Gemini 1.5 Pro", provider: "Google" },
    { id: "grok-beta", name: "Grok Beta", provider: "xAI" }
];

// Workspace Metadata Types
interface WorkspaceInfo {
    app_name: string;
    instance_id: string;
}

export default function Settings() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    const [vaultKeys, setVaultKeys] = useState<VaultKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // State for inputs
    const [inputValues, setInputValues] = useState<Record<string, string>>({});
    const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
    const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
    const [savedSuccess, setSavedSuccess] = useState<Record<string, boolean>>({});

    // State for Global Brain Configs
    const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
        default_model: "gpt-4o",
        temperature: 0.7,
        memory_enabled: true
    });
    const [savingConfig, setSavingConfig] = useState(false);
    const [showMemoryConfirm, setShowMemoryConfirm] = useState(false);
    const [clearingMemory, setClearingMemory] = useState(false);

    // State for Workspace
    const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceInfo>({ app_name: "", instance_id: "" });
    const [appNameInput, setAppNameInput] = useState("");
    const [savingWorkspace, setSavingWorkspace] = useState(false);
    const [workspaceSuccess, setWorkspaceSuccess] = useState(false);

    // Toast State
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Vault Inline States
    const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
    const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
    const [hasPin, setHasPin] = useState(true);

    // Inactivity Timer (5 minutes) for Inline Vault
    useEffect(() => {
        if (!isVaultUnlocked) return;

        let timeoutId: NodeJS.Timeout;
        const resetTimer = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setIsVaultUnlocked(false);
            }, 5 * 60 * 1000); // 5 minutes
        };

        window.addEventListener("mousemove", resetTimer);
        window.addEventListener("keydown", resetTimer);
        resetTimer();

        return () => {
            window.removeEventListener("mousemove", resetTimer);
            window.removeEventListener("keydown", resetTimer);
            clearTimeout(timeoutId);
        };
    }, [isVaultUnlocked]);

    useEffect(() => {
        setMounted(true);
        fetchSettingsData();
    }, []);

    const fetchSettingsData = async () => {
        setIsLoading(true);
        try {
            // Check server health first
            try {
                const healthRes = await fetchWithTimeout(`${API_BASE}/api/health`, { timeout: 3000 });
                if (!healthRes.ok) throw new Error("Health check failed");
            } catch (err) {
                console.error("Health check error:", err);
                setToast({ message: "Server Offline: Make sure your backend (uvicorn) is running.", type: "error" });
                setIsLoading(false);
                return;
            }

            const [keysRes, configRes, workspaceRes, pinRes] = await Promise.all([
                fetchWithTimeout(`${API_BASE}/api/vault/list`),
                fetchWithTimeout(`${API_BASE}/api/config`),
                fetchWithTimeout(`${API_BASE}/api/workspace/info`).catch(() => null),
                fetchWithTimeout(`${API_BASE}/api/vault/has-pin`).catch(() => null)
            ]);

            if (pinRes && pinRes.ok) {
                const pinData = await pinRes.json();
                setHasPin(pinData.has_pin);
            }

            if (keysRes.ok) {
                const data = await keysRes.json();
                setVaultKeys(data && Array.isArray(data) ? data : []);

                const initialInputs: Record<string, string> = {};
                if (data && Array.isArray(data)) {
                    data.forEach((k: VaultKey) => {
                        initialInputs[k.key_name] = k.masked_value;
                    });
                }
                setInputValues(initialInputs);
            }

            if (configRes && configRes.ok) {
                const configData = await configRes.json();
                if (configData) setGlobalConfig(configData);
            }

            if (workspaceRes && workspaceRes.ok) {
                const wsData = await workspaceRes.json();
                if (wsData) {
                    setWorkspaceInfo(wsData);
                    setAppNameInput(wsData.app_name || "");
                }
            }
        } catch (error) {
            console.error("Failed to fetch settings data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateConfig = async (key: keyof GlobalConfig, value: any) => {
        const newConfig = { ...globalConfig, [key]: value };
        setGlobalConfig(newConfig);
        setSavingConfig(true);

        try {
            await fetch(`${API_BASE}/api/config/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [key]: value })
            });
        } catch (err) {
            console.error("Failed to save config:", err);
        } finally {
            setSavingConfig(false);
        }
    };

    const handleClearMemory = async () => {
        setClearingMemory(true);
        try {
            await fetch(`${API_BASE}/api/config/clear-memory`, {
                method: "POST"
            });
            setShowMemoryConfirm(false);
        } catch (err) {
            console.error("Failed to clear memory:", err);
        } finally {
            setClearingMemory(false);
        }
    };

    const handleSaveWorkspace = async () => {
        if (!appNameInput.trim() || appNameInput === workspaceInfo.app_name) return;
        setSavingWorkspace(true);
        try {
            const res = await fetch(`${API_BASE}/api/workspace/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ app_name: appNameInput })
            });
            if (res.ok) {
                setWorkspaceSuccess(true);
                setWorkspaceInfo(prev => ({ ...prev, app_name: appNameInput }));
                setTimeout(() => setWorkspaceSuccess(false), 2000);
            }
        } catch (err) {
            console.error("Failed to save workspace info:", err);
        } finally {
            setSavingWorkspace(false);
        }
    };

    const handleSave = async (category: string, keyName: string) => {
        const val = inputValues[keyName];
        if (!val || val.trim() === "") {
            setToast({ message: "Mawa, key empty ga undhi. Paste chesi save cheyi.", type: "error" });
            setTimeout(() => setToast(null), 4000);
            return;
        }

        if (val.includes("••••••••")) return; // Don't save if unchanged masked

        setSavingKeys(prev => ({ ...prev, [keyName]: true }));
        const url = `${API_BASE}/api/vault/save`;
        const payload = { key_name: keyName, value: val, category };
        console.log(`[Save Key] Sending request to: ${url}`, payload);

        try {
            const res = await fetchWithTimeout(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key_name: keyName, value: val, category })
            });

            const data = await res.json();

            if (res.ok) {
                setToast({ message: "Success: API key encrypted and saved to Vault.", type: "success" });
                setSavedSuccess(prev => ({ ...prev, [keyName]: true }));
                setTimeout(() => setSavedSuccess(prev => ({ ...prev, [keyName]: false })), 2000);
                setTimeout(() => setToast(null), 4000);
                await fetchSettingsData(); // Refresh to get masked version
            } else {
                setToast({ message: data.detail || "Failed to save key.", type: "error" });
                setTimeout(() => setToast(null), 5000);
            }
        } catch (error) {
            console.error(`Failed to save ${keyName}:`, error);
            setToast({ message: "Network Error: Failed to reach backend.", type: "error" });
            setTimeout(() => setToast(null), 5000);
        } finally {
            setSavingKeys(prev => ({ ...prev, [keyName]: false }));
        }
    };

    const toggleVisibility = (keyName: string) => {
        setVisibleKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }));
    };

    const handleInputChange = (keyName: string, value: string) => {
        setInputValues(prev => ({ ...prev, [keyName]: value }));
    };

    return (
        <>
            <div className="flex flex-col h-full w-full p-6 md:p-8 bg-white dark:bg-[#111111] overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl w-full mx-auto flex flex-col gap-8 h-full"
                >
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black shadow-lg flex items-center justify-center border border-gray-200 dark:border-gray-800">
                            <KeyRound size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-black dark:text-white tracking-tight">
                                The Vault
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Secure, encrypted storage for your API keys and development secrets.
                            </p>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">

                            {/* ── Workspace & Appearance Card ── */}
                            <div className="relative bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm overflow-hidden">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-black dark:text-white">
                                        <LayoutTemplate className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-black dark:text-white">Workspace</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your instance identity and aesthetic preferences.</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Instance Name */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 pl-1 uppercase tracking-wider">
                                            Instance Name
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                name="workspace-instance-name"
                                                value={appNameInput}
                                                onChange={(e) => setAppNameInput(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && handleSaveWorkspace()}
                                                autoComplete="off"
                                                data-lpignore="true"
                                                data-1p-ignore
                                                placeholder="PlotAI Workspace"
                                                className="flex-1 bg-gray-50 dark:bg-[#1A1A1A] text-black dark:text-white border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm outline-none ring-0 placeholder:text-gray-400 transition-colors"
                                            />
                                            <button
                                                onClick={handleSaveWorkspace}
                                                disabled={savingWorkspace || appNameInput === workspaceInfo.app_name}
                                                className={`shrink-0 px-4 h-[46px] flex items-center justify-center rounded-2xl border transition-all duration-300
                                                    ${workspaceSuccess
                                                        ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                                                        : appNameInput !== workspaceInfo.app_name
                                                            ? "bg-black text-white hover:bg-gray-900 border-black dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:border-white"
                                                            : "bg-gray-100 text-gray-400 border-gray-200 dark:bg-[#1A1A1A] dark:border-gray-800 cursor-not-allowed"
                                                    }
                                                `}
                                            >
                                                {workspaceSuccess ? <ShieldCheck size={18} /> : <span className="text-xs font-bold">SAVE</span>}
                                            </button>
                                        </div>
                                        {workspaceInfo.instance_id && (
                                            <p className="text-xs text-gray-400 pl-1 font-mono">ID: {workspaceInfo.instance_id}</p>
                                        )}
                                    </div>

                                    {/* Appearance Toggle */}
                                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-black dark:text-white">Appearance</p>
                                            <p className="text-xs text-gray-500">Toggle strict B/W high-contrast mode</p>
                                        </div>
                                        <div className="flex bg-gray-100 dark:bg-[#1A1A1A] rounded-full p-1 border border-gray-200 dark:border-gray-800">
                                            <button
                                                onClick={() => mounted && setTheme("light")}
                                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mounted && theme === "light"
                                                    ? "bg-white text-black shadow-sm border border-gray-200"
                                                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 border border-transparent"
                                                    }`}
                                            >
                                                <Sun size={14} /> Light
                                            </button>
                                            <button
                                                onClick={() => mounted && setTheme("dark")}
                                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mounted && theme === "dark"
                                                    ? "bg-[#222] text-white shadow-sm border border-gray-700"
                                                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 border border-transparent"
                                                    }`}
                                            >
                                                <Moon size={14} /> Dark
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Global Brain Configs Card ── */}
                            <div className="relative bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm overflow-hidden">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-black dark:text-white">
                                        <BrainCircuit className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-black dark:text-white">Global Brain Configs</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Configure default agent behavior and overarching limits.</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Default Model */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 pl-1 uppercase tracking-wider">
                                            Default OpenAI Model
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={globalConfig.default_model}
                                                onChange={(e) => updateConfig("default_model", e.target.value)}
                                                className="w-full appearance-none bg-gray-50 dark:bg-[#1A1A1A] text-black dark:text-white border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600 transition-colors cursor-pointer"
                                            >
                                                {MODELS.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Temperature Slider */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between pl-1">
                                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Creativity (Temperature)
                                            </label>
                                            <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md">
                                                {globalConfig.temperature.toFixed(2)}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0" max="1" step="0.05"
                                            value={globalConfig.temperature}
                                            onChange={(e) => updateConfig("temperature", parseFloat(e.target.value))}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
                                        />
                                        <div className="flex justify-between text-[10px] text-gray-400 px-1">
                                            <span>Precise (0.0)</span>
                                            <span>Creative (1.0)</span>
                                        </div>
                                    </div>

                                    {/* Memory Switch & Clear Vector Store */}
                                    <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => updateConfig("memory_enabled", !globalConfig.memory_enabled)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${globalConfig.memory_enabled ? 'bg-black dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition-transform ${globalConfig.memory_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                            <div>
                                                <p className="text-sm font-semibold text-black dark:text-white">Active Memory (RAG)</p>
                                                <p className="text-xs text-gray-500">Allow agents to retain context via ChromaDB</p>
                                            </div>
                                        </div>

                                        {/* Double Confirmation Delete */}
                                        <div className="relative">
                                            {showMemoryConfirm ? (
                                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                                                    <span className="text-xs font-medium text-red-500">Are you sure?</span>
                                                    <button
                                                        onClick={() => setShowMemoryConfirm(false)}
                                                        className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleClearMemory}
                                                        disabled={clearingMemory}
                                                        className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                                                    >
                                                        {clearingMemory ? "Clearing..." : "Yes, Purge"}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setShowMemoryConfirm(true)}
                                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 rounded-xl transition-colors border border-red-100 dark:border-red-500/10 shrink-0"
                                                >
                                                    <Database size={16} />
                                                    Clear Vector Store
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Vault Categories ── */}
                            {!isVaultUnlocked && (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 dark:bg-gray-800 text-black dark:text-white rounded-xl">
                                            <Lock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-black dark:text-white tracking-tight">Vault Locked</h3>
                                            <p className="text-xs text-gray-500">API keys and secrets are masked. Unlock to edit.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsVaultModalOpen(true)}
                                        className="shrink-0 px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-xs font-bold shadow-sm outline-none ring-0 hover:opacity-90 transition-opacity"
                                    >
                                        {hasPin ? "Unlock Vault to Edit Keys" : "Setup Vault PIN"}
                                    </button>
                                </div>
                            )}

                            {CATEGORIES.map(category => (
                                <div key={category.id} className="relative bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm overflow-hidden">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
                                            <category.icon className="w-5 h-5 text-black dark:text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-black dark:text-white">{category.label}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{category.desc}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {PREDEFINED_KEYS[category.id as keyof typeof PREDEFINED_KEYS].map(keyName => {
                                            const isVisible = visibleKeys[keyName];
                                            const isSaving = savingKeys[keyName];
                                            const isSuccess = savedSuccess[keyName];

                                            // We use the inputValues fallback only if loaded
                                            const value = inputValues[keyName] || "";
                                            const isNewEdited = value !== "" && !value.includes("••••••••");

                                            return (
                                                <div key={keyName} className="flex flex-col gap-1.5 relative">
                                                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 pl-1 uppercase tracking-wider">
                                                        {keyName}
                                                    </label>

                                                    {/* Animated Saving Pulse Background */}
                                                    <AnimatePresence>
                                                        {isSaving && (
                                                            <motion.div
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                className="absolute inset-0 top-6 bg-black/5 dark:bg-white/5 rounded-2xl z-0 animate-pulse"
                                                            />
                                                        )}
                                                    </AnimatePresence>

                                                    <div className="flex items-center gap-2 relative z-10 w-full group">
                                                        <div className="relative flex-1">
                                                            {!isVaultUnlocked ? (
                                                                <div className="w-full flex items-center bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 h-[46px]">
                                                                    <span className="text-gray-400 dark:text-gray-500 font-mono tracking-widest text-lg w-full">••••••••••••••••</span>
                                                                    <Lock size={16} className="text-gray-400 shrink-0" />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <input
                                                                        type={isVisible ? "text" : "password"}
                                                                        name={`vault-${keyName.toLowerCase()}`}
                                                                        value={value}
                                                                        onChange={(e) => handleInputChange(keyName, e.target.value)}
                                                                        autoComplete="new-password"
                                                                        placeholder="Paste your key here..."
                                                                        className="w-full bg-white dark:bg-[#000000] text-black dark:text-white border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm outline-none ring-0 focus:border-black dark:focus:border-white placeholder:text-gray-400 transition-colors"
                                                                        data-lpignore="true"
                                                                        data-1p-ignore
                                                                    />
                                                                    <button
                                                                        onClick={() => toggleVisibility(keyName)}
                                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white transition-colors p-1"
                                                                    >
                                                                        {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>

                                                        {isVaultUnlocked && (
                                                            <button
                                                                onClick={() => handleSave(category.id, keyName)}
                                                                disabled={isSaving || !isNewEdited}
                                                                className={`shrink-0 w-12 h-11 flex items-center justify-center rounded-2xl border transition-all duration-300 outline-none ring-0
                                                                    ${isSuccess
                                                                        ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                                                                        : isSaving
                                                                            ? "bg-gray-100 text-gray-400 border-gray-200 dark:bg-[#1A1A1A] dark:border-gray-800 cursor-not-allowed"
                                                                            : isNewEdited
                                                                                ? "bg-black text-white hover:bg-gray-900 border-black dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:border-white"
                                                                                : "bg-gray-100 text-gray-400 border-gray-200 dark:bg-[#1A1A1A] dark:border-gray-800 cursor-not-allowed"
                                                                    }
                                                                `}
                                                            >
                                                                {isSuccess ? (
                                                                    <motion.div
                                                                        initial={{ scale: 0.5, opacity: 0 }}
                                                                        animate={{ scale: 1, opacity: 1 }}
                                                                        className="flex items-center justify-center"
                                                                    >
                                                                        <ShieldCheck size={18} />
                                                                    </motion.div>
                                                                ) : (
                                                                    <span className="text-xs font-bold">{isSaving ? "Saving..." : "SAVE"}</span>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* ── Toast Notification ── */}
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.95 }}
                            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all
                                ${toast.type === "success"
                                    ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                                    : "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                                }
                            `}
                        >
                            {toast.type === "success" ? (
                                <ShieldCheck size={20} className="text-white dark:text-black" />
                            ) : (
                                <AlertTriangle size={20} className="text-white dark:text-black" />
                            )}
                            <span className="text-sm font-bold tracking-tight">{toast.message}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* ── Vault PIN Modal ── */}
                <VaultPinModal
                    isOpen={isVaultModalOpen}
                    onClose={() => setIsVaultModalOpen(false)}
                    isSettingPin={!hasPin}
                    onPinSet={() => setHasPin(true)}
                    onSuccess={() => {
                        setIsVaultModalOpen(false);
                        setIsVaultUnlocked(true);
                    }}
                />
            </div>
        </>
    );
}
