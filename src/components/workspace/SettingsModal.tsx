/**
 * ════════════════════════════════════════════════════════════════
 * Settings Modal — Vault Password + API Key Management
 * ════════════════════════════════════════════════════════════════
 *
 * States:
 *   1. No password → "Set Up Your Vault Password" (create + confirm + email)
 *   2. Locked → "Enter vault password" (with Forgot Password link)
 *   3. Forgot Password → Enter email → OTP → New password
 *   4. Unlocked → Provider toggles + API key accordion
 */
"use client";

import { useState, useMemo } from "react";
import { useUIStore, ProviderOption } from "@/store/uiStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import OllamaSetupModal from "./OllamaSetupModal";

const PROVIDERS: { id: ProviderOption; label: string; placeholder: string }[] = [
    { id: "openai", label: "OpenAI", placeholder: "sk-..." },
    { id: "gemini", label: "Google Gemini", placeholder: "AIza..." },
    { id: "claude", label: "Anthropic Claude", placeholder: "sk-ant-..." },
    { id: "grok", label: "xAI Grok", placeholder: "xai-..." },
];

function maskKey(key: string): string {
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

type ModalView = "create" | "locked" | "forgot" | "otp" | "reset" | "unlocked";

export default function SettingsModal() {
    const {
        settingsOpen,
        setSettingsOpen,
        isVaultUnlocked,
        hasVaultPassword,
        vaultEmail,
        createVaultPassword,
        unlockVault,
        lockVault,
        resetVaultPassword,
        apiKeys,
        setApiKey,
        removeApiKey,
        activeProviders,
        toggleProvider,
        setOllamaModalOpen,
    } = useUIStore();

    // ── Ollama activation handler ───────────────────────
    const handleOllamaActivate = async () => {
        // On HTTPS (e.g. Vercel), browsers block http://localhost fetches (mixed content).
        // Skip the check and show the setup modal with a clear warning.
        if (typeof window !== "undefined" && window.location.protocol === "https:") {
            setOllamaModalOpen(true);
            return;
        }

        try {
            const res = await fetch("http://localhost:11434/api/tags", {
                method: "GET",
                signal: AbortSignal.timeout(2_000),
            });
            if (res.ok) {
                // Ollama is running — activate normally
                toggleProvider("ollama");
                return;
            }
        } catch {
            // Not reachable
        }
        // Open the setup modal instead
        setOllamaModalOpen(true);
    };

    // ── View state ─────────────────────────────────────────
    const [view, setView] = useState<ModalView>(
        isVaultUnlocked ? "unlocked" : hasVaultPassword ? "locked" : "create"
    );

    // ── Form state ─────────────────────────────────────────
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newResetPassword, setNewResetPassword] = useState("");
    const [confirmResetPassword, setConfirmResetPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");

    // ── API key state ──────────────────────────────────────
    const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
    const [newKey, setNewKey] = useState("");
    const [keyMessage, setKeyMessage] = useState<{ type: string; text: string } | null>(null);

    // ── Helpers ────────────────────────────────────────────
    const clearForm = () => {
        setPassword("");
        setConfirmPassword("");
        setEmail("");
        setOtp("");
        setNewResetPassword("");
        setConfirmResetPassword("");
        setError("");
        setSuccessMsg("");
    };

    const handleClose = () => {
        lockVault();
        clearForm();
        setView(hasVaultPassword ? "locked" : "create");
        setSettingsOpen(false);
    };

    // ── CREATE password ────────────────────────────────────
    const handleCreate = async () => {
        if (password.length < 4) { setError("Password must be at least 4 characters"); return; }
        if (password !== confirmPassword) { setError("Passwords do not match"); return; }
        if (!email || !email.includes("@")) { setError("Valid email is required for password recovery"); return; }
        setLoading(true);
        await createVaultPassword(password, email);
        setLoading(false);
        clearForm();
        setView("unlocked");
    };

    // ── UNLOCK ─────────────────────────────────────────────
    const handleUnlock = async () => {
        if (!password.trim()) { setError("Please enter your password"); return; }
        setLoading(true);
        const success = await unlockVault(password);
        setLoading(false);
        if (success) {
            clearForm();
            setView("unlocked");
        } else {
            setError("Incorrect vault password");
        }
    };

    // ── FORGOT: Send OTP ───────────────────────────────────
    const handleSendOtp = async () => {
        const targetEmail = email || vaultEmail;
        if (!targetEmail) { setError("No email associated. Please enter your email."); return; }
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/vault/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: targetEmail }),
            });
            const data = await res.json();
            if (res.ok) {
                setEmail(targetEmail);
                setSuccessMsg(data.devMode
                    ? "OTP printed to server console (SMTP not configured)"
                    : `OTP sent to ${targetEmail}`
                );
                setView("otp");
            } else {
                setError(data.error || "Failed to send OTP");
            }
        } catch {
            setError("Network error");
        }
        setLoading(false);
    };

    // ── FORGOT: Verify OTP ─────────────────────────────────
    const handleVerifyOtp = async () => {
        if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/vault/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp }),
            });
            const data = await res.json();
            if (res.ok) {
                setSuccessMsg("OTP verified! Set your new password.");
                setView("reset");
            } else {
                setError(data.error || "Invalid OTP");
            }
        } catch {
            setError("Network error");
        }
        setLoading(false);
    };

    // ── FORGOT: Reset password ─────────────────────────────
    const handleResetPassword = async () => {
        if (newResetPassword.length < 4) { setError("Password must be at least 4 characters"); return; }
        if (newResetPassword !== confirmResetPassword) { setError("Passwords do not match"); return; }
        setLoading(true);
        await resetVaultPassword(newResetPassword);
        setLoading(false);
        clearForm();
        setView("unlocked");
    };

    // ── API key save/delete ────────────────────────────────
    const handleSaveKey = (providerId: string) => {
        if (!newKey.trim()) return;
        setApiKey(providerId, newKey.trim());
        setNewKey("");
        setKeyMessage({ type: "success", text: `${providerId} API key saved` });
        setTimeout(() => setKeyMessage(null), 3000);
    };

    const handleDeleteKey = (providerId: string) => {
        removeApiKey(providerId);
        setKeyMessage({ type: "success", text: `${providerId} key removed` });
        setTimeout(() => setKeyMessage(null), 3000);
    };

    if (!settingsOpen) return null;

    // Determine current view based on store state
    const currentView = isVaultUnlocked ? "unlocked" : view;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={handleClose} />

            <div data-ai-ignore className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto mx-4 bg-white border border-gray-200 rounded-xl shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Settings</h2>
                    <button onClick={handleClose} className="p-1 rounded hover:bg-gray-100">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Key message */}
                {keyMessage && (
                    <div className={`mx-5 mt-4 p-3 rounded-lg border text-sm ${keyMessage.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
                        }`}>{keyMessage.text}</div>
                )}

                {/* ══════════════════════════════════════════════════
         * STATE: CREATE — First time vault setup
         * ══════════════════════════════════════════════════ */}
                {currentView === "create" && (
                    <div className="p-5">
                        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🔐</span>
                                <h3 className="text-sm font-semibold text-blue-800">Set Up Your Vault Password</h3>
                            </div>
                            <p className="text-sm text-blue-700 mb-4">
                                Create a master password to protect your API keys. Enter your email for password recovery.
                            </p>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Email (for password recovery)</label>
                                    <input
                                        type="text"
                                        name="vault-recovery-email"
                                        autoComplete="off"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setError(""); }}
                                        placeholder="your@email.com"
                                        className="w-full px-3 py-2 border border-gray-300 bg-white text-[#1a1a1a] placeholder:text-gray-400 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                                    <input
                                        type="password"
                                        name="vault-new-pw"
                                        autoComplete="new-password"
                                        data-lpignore="true"
                                        data-1p-ignore
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                        placeholder="Enter a vault password (min 4 chars)"
                                        className="w-full px-3 py-2 border border-gray-300 bg-white text-[#1a1a1a] placeholder:text-gray-400 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Password</label>
                                    <input
                                        type="password"
                                        name="vault-confirm-pw"
                                        autoComplete="new-password"
                                        data-lpignore="true"
                                        data-1p-ignore
                                        value={confirmPassword}
                                        onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                                        placeholder="Confirm your password"
                                        className="w-full px-3 py-2 border border-gray-300 bg-white text-[#1a1a1a] placeholder:text-gray-400 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                                    />
                                </div>
                                <button
                                    onClick={handleCreate}
                                    disabled={loading}
                                    className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 font-medium"
                                >
                                    {loading ? "Creating..." : "Create Vault Password"}
                                </button>
                            </div>
                            {error && <p className="text-xs text-red-500 mt-2">⚠️ {error}</p>}
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════
         * STATE: LOCKED — Enter password to unlock
         * ══════════════════════════════════════════════════ */}
                {currentView === "locked" && (
                    <div className="p-5">
                        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🔒</span>
                                <h3 className="text-sm font-semibold text-amber-800">Vault is Locked</h3>
                            </div>
                            <p className="text-sm text-amber-700 mb-4">
                                Enter your vault password to access and manage your API keys.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    name="vault-unlock-pw"
                                    autoComplete="off"
                                    data-lpignore="true"
                                    data-1p-ignore
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                    onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                                    placeholder="Enter vault password"
                                    className="flex-1 px-3 py-2 border border-gray-300 bg-white text-[#1a1a1a] placeholder:text-gray-400 rounded-lg text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                                />
                                <button
                                    onClick={handleUnlock}
                                    disabled={loading}
                                    className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50 font-medium"
                                >
                                    {loading ? "..." : "Unlock"}
                                </button>
                            </div>
                            {error && <p className="text-xs text-red-500 mt-2">⚠️ {error}</p>}

                            {/* Forgot password link */}
                            <button
                                onClick={() => { clearForm(); setEmail(vaultEmail || ""); setView("forgot"); }}
                                className="mt-3 text-xs text-blue-600 hover:underline"
                            >
                                Forgot vault password?
                            </button>
                        </div>

                        {/* Provider toggles (always visible) */}
                        <ProviderToggles activeProviders={activeProviders} toggleProvider={toggleProvider} onOllamaActivate={handleOllamaActivate} />
                    </div>
                )}

                {/* ══════════════════════════════════════════════════
         * STATE: FORGOT — Enter email to receive OTP
         * ══════════════════════════════════════════════════ */}
                {currentView === "forgot" && (
                    <div className="p-5">
                        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">📧</span>
                                <h3 className="text-sm font-semibold text-blue-800">Reset Vault Password</h3>
                            </div>
                            <p className="text-sm text-blue-700 mb-4">
                                Enter your email to receive a verification code.
                            </p>
                            <input
                                type="text"
                                name="vault-reset-email"
                                autoComplete="off"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                                placeholder="your@email.com"
                                className="w-full px-3 py-2 border border-gray-300 bg-white text-[#1a1a1a] placeholder:text-gray-400 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all mb-3"
                            />
                            <button
                                onClick={handleSendOtp}
                                disabled={loading}
                                className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 font-medium"
                            >
                                {loading ? "Sending..." : "Send OTP"}
                            </button>
                            {error && <p className="text-xs text-red-500 mt-2">⚠️ {error}</p>}
                            <button
                                onClick={() => { clearForm(); setView("locked"); }}
                                className="mt-3 text-xs text-gray-500 hover:underline"
                            >
                                ← Back to unlock
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════
         * STATE: OTP — Enter the 6-digit code
         * ══════════════════════════════════════════════════ */}
                {currentView === "otp" && (
                    <div className="p-5">
                        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🔢</span>
                                <h3 className="text-sm font-semibold text-blue-800">Enter Verification Code</h3>
                            </div>
                            {successMsg && <p className="text-xs text-green-600 mb-3">✅ {successMsg}</p>}
                            <p className="text-sm text-blue-700 mb-4">
                                Enter the 6-digit code sent to <strong>{email}</strong>
                            </p>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    name="vault-otp-code"
                                    autoComplete="one-time-code"
                                    value={otp}
                                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                                    onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                                    placeholder="000000"
                                    maxLength={6}
                                    className="flex-1 px-3 py-3 border border-gray-300 bg-white text-[#1a1a1a] placeholder:text-gray-400 rounded-lg text-center text-lg font-mono tracking-[0.5em] outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                                />
                            </div>
                            <button
                                onClick={handleVerifyOtp}
                                disabled={loading || otp.length !== 6}
                                className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 font-medium"
                            >
                                {loading ? "Verifying..." : "Verify OTP"}
                            </button>
                            {error && <p className="text-xs text-red-500 mt-2">⚠️ {error}</p>}
                            <button
                                onClick={handleSendOtp}
                                disabled={loading}
                                className="mt-3 text-xs text-blue-600 hover:underline"
                            >
                                Resend OTP
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════
         * STATE: RESET — Set new password after OTP verified
         * ══════════════════════════════════════════════════ */}
                {currentView === "reset" && (
                    <div className="p-5">
                        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🔑</span>
                                <h3 className="text-sm font-semibold text-green-800">Set New Vault Password</h3>
                            </div>
                            {successMsg && <p className="text-xs text-green-600 mb-3">✅ {successMsg}</p>}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                                    <input
                                        type="password"
                                        name="vault-reset-new-pw"
                                        autoComplete="new-password"
                                        data-lpignore="true"
                                        data-1p-ignore
                                        value={newResetPassword}
                                        onChange={(e) => { setNewResetPassword(e.target.value); setError(""); }}
                                        placeholder="Enter new vault password"
                                        className="w-full px-3 py-2 border border-gray-300 bg-white text-[#1a1a1a] placeholder:text-gray-400 rounded-lg text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        name="vault-reset-confirm-pw"
                                        autoComplete="new-password"
                                        data-lpignore="true"
                                        data-1p-ignore
                                        value={confirmResetPassword}
                                        onChange={(e) => { setConfirmResetPassword(e.target.value); setError(""); }}
                                        onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                                        placeholder="Confirm new password"
                                        className="w-full px-3 py-2 border border-gray-300 bg-white text-[#1a1a1a] placeholder:text-gray-400 rounded-lg text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-all"
                                    />
                                </div>
                                <button
                                    onClick={handleResetPassword}
                                    disabled={loading}
                                    className="w-full py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 font-medium"
                                >
                                    {loading ? "Saving..." : "Save New Password"}
                                </button>
                            </div>
                            {error && <p className="text-xs text-red-500 mt-2">⚠️ {error}</p>}
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════
         * STATE: UNLOCKED — Full settings UI
         * ══════════════════════════════════════════════════ */}
                {currentView === "unlocked" && (
                    <>
                        {/* Vault unlocked bar */}
                        <div className="mx-5 mt-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">🔓</span>
                                <span className="text-sm text-green-700 font-medium">Vault Unlocked</span>
                            </div>
                            <button onClick={() => { lockVault(); setView("locked"); }} className="text-xs text-gray-500 hover:text-red-500">
                                Lock
                            </button>
                        </div>

                        {/* Active providers */}
                        <div className="p-5 border-b border-gray-100">
                            <ProviderToggles activeProviders={activeProviders} toggleProvider={toggleProvider} onOllamaActivate={handleOllamaActivate} />
                        </div>

                        {/* API Keys */}
                        <div className="p-5 space-y-2">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">API Keys</h3>
                            {PROVIDERS.map((provider) => {
                                const savedKey = apiKeys[provider.id];
                                const isExpanded = expandedProvider === provider.id;
                                return (
                                    <div key={provider.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                        <button
                                            onClick={() => { setExpandedProvider(isExpanded ? null : provider.id); setNewKey(""); }}
                                            className="flex items-center justify-between w-full p-3 hover:bg-gray-50"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-800">{provider.label}</span>
                                                {savedKey && (
                                                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-600 border border-green-200">✓ Configured</span>
                                                )}
                                            </div>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </button>
                                        {isExpanded && (
                                            <div className="px-3 pb-3 space-y-2">
                                                {savedKey && (
                                                    <div className="flex items-center justify-between p-2 rounded bg-gray-50">
                                                        <code className="text-sm text-gray-600 font-mono">{maskKey(savedKey)}</code>
                                                        <button onClick={() => handleDeleteKey(provider.id)} className="px-2 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50">Delete</button>
                                                    </div>
                                                )}
                                                <div className="flex gap-2">
                                                    <input type="text" name="api-key-input" autoComplete="off" data-lpignore="true" data-1p-ignore placeholder={provider.placeholder} value={newKey}
                                                        onChange={(e) => setNewKey(e.target.value)}
                                                        onKeyDown={(e) => e.key === "Enter" && handleSaveKey(provider.id)}
                                                        className="flex-1 px-3 py-2 border border-gray-200 bg-white text-[#1a1a1a] placeholder:text-gray-400 rounded-lg text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-all" />
                                                    <button onClick={() => handleSaveKey(provider.id)} disabled={!newKey.trim()}
                                                        className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">Save</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Ollama */}
                        <div className="px-5 pb-5">
                            <div className="border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-gray-800">Ollama</span>
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">Local</span>
                                </div>
                                <p className="text-xs text-gray-500">No API key required. Ensure Ollama runs at <code className="text-gray-600">http://localhost:11434</code></p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Ollama Setup Modal */}
            <OllamaSetupModal />
        </div>
    );
}

// ── Reusable Provider Toggles Component ──────────────────
function ProviderToggles({ activeProviders, toggleProvider, onOllamaActivate }: {
    activeProviders: ProviderOption[];
    toggleProvider: (p: ProviderOption) => void;
    onOllamaActivate: () => void;
}) {
    const isMobile = useIsMobile();

    const providers: { id: ProviderOption; label: string }[] = useMemo(() => {
        const list: { id: ProviderOption; label: string }[] = [
            { id: "openai", label: "OpenAI" },
            { id: "gemini", label: "Gemini" },
            { id: "claude", label: "Claude" },
            { id: "grok", label: "Grok" },
            { id: "ollama", label: "Ollama" },
        ];
        if (isMobile) return list.filter((p) => p.id !== "ollama");
        return list;
    }, [isMobile]);

    const handleToggle = (id: ProviderOption) => {
        if (id === "ollama") {
            const isActive = activeProviders.includes("ollama");
            if (isActive) {
                // Toggling OFF — no check needed
                toggleProvider("ollama");
            } else {
                // Toggling ON — run async check
                onOllamaActivate();
            }
        } else {
            toggleProvider(id);
        }
    };

    return (
        <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Active Providers</h3>
            <div className="flex flex-wrap gap-2">
                {providers.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => handleToggle(p.id)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-all ${activeProviders.includes(p.id) ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-300"
                            }`}
                    >{p.label}</button>
                ))}
            </div>
        </div>
    );
}
