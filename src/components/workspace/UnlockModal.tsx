/**
 * ════════════════════════════════════════════════════════════════
 * Vault Unlock Modal
 * ════════════════════════════════════════════════════════════════
 *
 * Prompts the user for their Secrets Password. On success,
 * calls NextAuth `update()` to inject the encrypted unlock
 * fragment into the JWT — enabling vault operations for 30min.
 *
 * The derived key NEVER exists in the browser. Only an encrypted
 * fragment (encrypted by NEXTAUTH_SECRET on the server) flows
 * through the client on its way to the HTTP-only JWT cookie.
 */
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useUIStore } from "@/store/uiStore";

export default function UnlockModal() {
    const { unlockModalOpen, setUnlockModalOpen } = useUIStore();
    const { update } = useSession();

    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleUnlock = async () => {
        if (!password.trim()) return;
        setLoading(true);
        setError("");

        try {
            // Step 1: Send password to server for PBKDF2 + AES derivation
            const res = await fetch("/api/vault/unlock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to unlock vault");
            }

            const { unlockFragment } = await res.json();

            // Step 2: Inject the encrypted fragment into the NextAuth JWT
            // This updates the HTTP-only cookie via NextAuth's update mechanism
            await update({ unlockFragment });

            setPassword("");
            setUnlockModalOpen(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unlock failed");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleUnlock();
        }
    };

    if (!unlockModalOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-md"
                onClick={() => setUnlockModalOpen(false)}
            />

            {/* Modal */}
            <div data-ai-ignore className="relative w-full max-w-md mx-4 bg-[#111118] border border-white/[0.08] rounded-2xl shadow-2xl shadow-violet-500/5">
                <div className="p-8">
                    {/* Lock Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-violet-500/20 flex items-center justify-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="28"
                                height="28"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-violet-400"
                            >
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-zinc-100 text-center mb-2">
                        Unlock Secrets Vault
                    </h2>
                    <p className="text-sm text-zinc-500 text-center mb-6">
                        Enter your vault password to access and manage your API keys.
                        The vault auto-locks after 30 minutes.
                    </p>

                    {error && (
                        <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter vault password..."
                        autoFocus
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/40 transition-colors text-sm"
                    />

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={() => setUnlockModalOpen(false)}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-zinc-400 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.06] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUnlock}
                            disabled={loading || !password.trim()}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-violet-500/20"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Unlocking...
                                </span>
                            ) : (
                                "Unlock"
                            )}
                        </button>
                    </div>

                    <p className="text-xs text-zinc-600 text-center mt-4">
                        Your vault password is never stored. It is used to derive the
                        encryption key via PBKDF2 for this session only.
                    </p>
                </div>
            </div>
        </div>
    );
}
