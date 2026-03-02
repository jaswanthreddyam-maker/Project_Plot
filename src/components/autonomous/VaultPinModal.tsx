"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ShieldCheck, Lock, ShieldAlert } from "lucide-react";
import { API_BASE, fetchWithTimeout } from "@/lib/api";

interface VaultPinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    isSettingPin: boolean;
    onPinSet: () => void;
}

export default function VaultPinModal({ isOpen, onClose, onSuccess, isSettingPin, onPinSet }: VaultPinModalProps) {
    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleVerifyPin = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/vault/verify-pin`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin })
            });

            if (res.ok) {
                setPin("");
                onSuccess();
            } else if (res.status === 400 || res.status === 401) {
                setError("Incorrect PIN. Try again.");
                setPin("");
            } else {
                setError("Vault Error: Server returned an invalid response.");
                setPin("");
            }
        } catch (err) {
            console.error(err);
            setError("Network Error: Vault is offline or unreachable.");
            setPin("");
        } finally {
            setLoading(false);
        }
    };

    const handleSetPin = async () => {
        if (pin !== confirmPin) {
            setError("PINs do not match.");
            return;
        }
        if (pin.length < 4 || pin.length > 6) {
            setError("PIN must be 4-6 digits.");
            return;
        }

        setLoading(true);
        setError("");
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/vault/set-pin`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin }),
                timeout: 15000,
            });

            if (res.ok) {
                setPin("");
                setConfirmPin("");
                onPinSet();
                onSuccess(); // Unlocks the vault directly after setting
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data?.detail || "Failed to set PIN.");
            }
        } catch (err) {
            const reason = err instanceof Error ? err.message : "Network error.";
            setError(reason.includes("timed out") ? "Request timed out. Check backend." : "Network error. Check backend and CORS.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-sm p-8 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl"
                >
                    <div className="w-16 h-16 bg-black dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                        {isSettingPin ? <ShieldAlert size={32} /> : <Lock size={32} />}
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                            {isSettingPin ? "Set Vault PIN" : "Vault Locked"}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            {isSettingPin
                                ? "Create a 4-6 digit security PIN to protect your enterprise API keys."
                                : "Enter your security PIN to access the encrypted vault."}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                                {isSettingPin ? "New PIN" : "Encryption PIN"}
                            </label>
                            <input
                                autoFocus
                                type="password"
                                name="vault-pin-entry"
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                onKeyDown={(e) => e.key === "Enter" && !isSettingPin && handleVerifyPin()}
                                autoComplete="one-time-code"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                data-lpignore="true"
                                data-1p-ignore
                                placeholder="••••••"
                                className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-2xl tracking-[1em] text-center font-bold focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-slate-900 dark:text-white"
                            />
                        </div>

                        {isSettingPin && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                                    Confirm PIN
                                </label>
                                <input
                                    type="password"
                                    name="vault-pin-confirm"
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
                                    autoComplete="one-time-code"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    data-lpignore="true"
                                    data-1p-ignore
                                    placeholder="••••••"
                                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-2xl tracking-[1em] text-center font-bold focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-slate-900 dark:text-white"
                                />
                            </div>
                        )}

                        {error && (
                            <p className="text-xs font-semibold text-red-500 text-center animate-in shake">
                                {error}
                            </p>
                        )}

                        <button
                            onClick={isSettingPin ? handleSetPin : handleVerifyPin}
                            disabled={loading || pin.length < 4}
                            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98]"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isSettingPin ? "Create Secure Vault" : "Unlock Vault"}
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full py-2 mt-2 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AES-256 Military Grade</span>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
