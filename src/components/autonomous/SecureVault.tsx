"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ShieldCheck, ArrowRight, ShieldAlert, KeyRound } from "lucide-react";
import { API_BASE, fetchWithTimeout } from "@/lib/api";

interface SecureVaultProps {
    children: React.ReactNode;
}

export default function SecureVault({ children }: SecureVaultProps) {
    const [isLocked, setIsLocked] = useState(true);
    const [hasPin, setHasPin] = useState<boolean | null>(null);
    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [isSettingPin, setIsSettingPin] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const checkHasPin = useCallback(async () => {
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/vault/has-pin`);
            if (res.ok) {
                const data = await res.json();
                setHasPin(data.has_pin);
                if (!data.has_pin) {
                    setIsSettingPin(true);
                }
            }
        } catch (err) {
            console.error("Failed to check PIN status", err);
        }
    }, []);

    useEffect(() => {
        checkHasPin();
    }, [checkHasPin]);

    // Inactivity Timer (5 minutes)
    useEffect(() => {
        if (isLocked) return;

        let timeoutId: NodeJS.Timeout;
        const resetTimer = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setIsLocked(true);
                setPin("");
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
    }, [isLocked]);

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
                setIsLocked(false);
                setPin("");
            } else {
                setError("Incorrect PIN. Try again.");
                setPin("");
            }
        } catch (err) {
            setError("Network error. Try again later.");
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
                body: JSON.stringify({ pin })
            });

            if (res.ok) {
                setHasPin(true);
                setIsSettingPin(false);
                setIsLocked(false);
                setPin("");
                setConfirmPin("");
            } else {
                setError("Failed to set PIN.");
            }
        } catch (err) {
            setError("Network error.");
        } finally {
            setLoading(false);
        }
    };

    if (hasPin === null) return null; // Loading state handled by parent or null

    if (!isLocked) {
        return <>{children}</>;
    }

    return (
        <div className="relative w-full h-full min-h-[500px] flex items-center justify-center bg-white dark:bg-[#111111]">
            {/* Blurred Background Preview */}
            <div className="absolute inset-0 blur-xl opacity-20 pointer-events-none select-none overflow-hidden">
                {children}
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 w-full max-w-sm p-8 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl"
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
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            onKeyDown={(e) => e.key === "Enter" && !isSettingPin && handleVerifyPin()}
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
                                value={confirmPin}
                                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
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

                    {!isSettingPin && (
                        <button
                            onClick={() => setIsSettingPin(true)}
                            className="w-full text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            Reset or Forgot PIN?
                        </button>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AES-256 Military Grade Encryption</span>
                </div>
            </motion.div>
        </div>
    );
}
