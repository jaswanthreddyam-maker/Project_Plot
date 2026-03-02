"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { API_BASE, fetchWithTimeout, readErrorMessage } from "@/lib/api";

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

function LoginPageContent() {
    const { data: session, status } = useSession();

    // UI State
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

    // Auth State
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [hasTriedGoogleExchange, setHasTriedGoogleExchange] = useState(false);

    const [formReady, setFormReady] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [googleAttemptId, setGoogleAttemptId] = useState(0);

    useEffect(() => {
        const t = setTimeout(() => setFormReady(true), 100);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        // Redirection on mount if token already exists
        const token = localStorage.getItem("plot_auth_token");
        if (token) {
            window.location.href = "/workspace";
        }
    }, []);

    const processLoginSuccess = (token: string) => {
        localStorage.setItem("plot_auth_token", token);
        window.location.href = "/workspace";
    };

    useEffect(() => {
        if (status !== "authenticated" || !session?.googleAccessToken || hasTriedGoogleExchange) return;

        let cancelled = false;

        const exchangeGoogleToken = async () => {
            setError("");
            setLoading(true);
            setHasTriedGoogleExchange(true);
            try {
                const res = await fetchWithTimeout(`${API_BASE}/api/auth/google`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: session.googleAccessToken }),
                    timeout: 15000,
                });
                if (!res.ok) {
                    const detail = await readErrorMessage(res, "Google authentication failed");
                    throw new Error(detail);
                }
                const data = await res.json();
                if (!data.access_token) {
                    throw new Error("Invalid token received from backend");
                }
                if (!cancelled) {
                    processLoginSuccess(data.access_token);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "An error occurred during Google sign in");
                    setLoading(false);
                }
            }
        };

        void exchangeGoogleToken();
        return () => {
            cancelled = true;
        };
    }, [session?.googleAccessToken, status, hasTriedGoogleExchange]);

    const handleGoogleSignIn = async () => {
        setError("");
        setLoading(true);
        setHasTriedGoogleExchange(false);
        setGoogleAttemptId((id) => id + 1);

        // Keep host consistent with NEXTAUTH_URL/Google console for local OAuth.
        if (typeof window !== "undefined" && window.location.hostname === "127.0.0.1") {
            const url = new URL(window.location.href);
            url.hostname = "localhost";
            window.location.href = url.toString();
            return;
        }

        try {
            await signIn("google", {
                callbackUrl: `${window.location.origin}/login?oauth=google`,
            }, {
                prompt: "select_account",
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Google sign-in failed. Please try again.");
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!loading || googleAttemptId === 0) return;

        const timer = setTimeout(() => {
            setLoading(false);
            setError("Google sign-in did not start. Check localhost auth config and retry.");
        }, 12000);

        return () => clearTimeout(timer);
    }, [loading, googleAttemptId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedName = name.trim();

        try {
            if (isRegister) {
                const res = await fetchWithTimeout("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: normalizedEmail, password, name: normalizedName }),
                    timeout: 15000,
                });
                if (!res.ok) {
                    const detail = await readErrorMessage(res, "Registration failed");
                    throw new Error(detail);
                }
            }

            // Credentials login against local Next.js auth route.
            const formData = new URLSearchParams();
            formData.append("username", normalizedEmail);
            formData.append("password", password);

            const apiRes = await fetchWithTimeout("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: formData,
                timeout: 15000,
            });

            if (!apiRes.ok) {
                const detail = await readErrorMessage(apiRes, "Invalid credentials");
                throw new Error(detail);
            }

            const data = await apiRes.json();
            if (data.access_token) {
                processLoginSuccess(data.access_token);
            } else {
                throw new Error("Invalid response from server");
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="w-full max-w-md mx-4">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
                    <div className="flex justify-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                </svg>
                            </div>
                            <span className="text-2xl font-bold text-black">Plot</span>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-black text-center mb-1">
                        {isRegister ? "Create Account" : "Welcome Back"}
                    </h2>
                    <p className="text-sm text-gray-500 text-center mb-6">
                        {isRegister
                            ? "Set up your multi-LLM workspace"
                            : "Sign in to your parallel AI workspace"}
                    </p>

                    {error && (
                        <div className="p-3 mb-5 rounded-lg bg-red-50 border border-red-200">
                            <p className="text-sm font-medium text-red-600 text-center">{error}</p>
                        </div>
                    )}

                    {!formReady ? (
                        <div className="space-y-4">
                            <div className="w-full h-[42px] rounded-2xl bg-gray-100 animate-pulse" />
                            <div className="w-full h-[42px] rounded-2xl bg-gray-100 animate-pulse" />
                            <div className="w-full h-[42px] rounded-2xl bg-black animate-pulse" />
                        </div>
                    ) : (
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            {isRegister && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Your name"
                                        autoComplete="off"
                                        className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 bg-white text-sm text-black placeholder:text-gray-400 outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    autoComplete="email"
                                    spellCheck="false"
                                    className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 bg-white text-sm text-black placeholder:text-gray-400 outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-sans"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="........"
                                        required
                                        minLength={8}
                                        autoComplete="current-password"
                                        spellCheck="false"
                                        className="w-full px-4 py-2.5 pr-10 rounded-2xl border border-gray-300 bg-white text-sm text-black placeholder:text-gray-400 outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-sans"
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); setShowPassword((prev) => !prev); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors z-10 cursor-pointer p-1"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        ) : (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 rounded-2xl text-sm font-semibold text-white bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors outline-none ring-0"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="w-4 h-4 text-white animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        {isRegister ? "Creating..." : "Signing in..."}
                                    </span>
                                ) : isRegister ? (
                                    "Create Account"
                                ) : (
                                    "Sign In"
                                )}
                            </button>
                        </form>
                    )}

                    <div className="flex items-center my-4">
                        <hr className="flex-grow border-gray-300 dark:border-neutral-700" />
                        <span className="px-3 text-sm text-gray-500">or</span>
                        <hr className="flex-grow border-gray-300 dark:border-neutral-700" />
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleGoogleSignIn()}
                        disabled={loading}
                        className="w-full border border-gray-300 dark:border-neutral-700 text-black dark:text-white rounded-md py-2 flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <GoogleIcon />
                        Continue with Google
                    </button>

                    <div className="mt-5 text-center">
                        <button
                            onClick={() => {
                                setIsRegister(!isRegister);
                                setError("");
                            }}
                            className="text-sm font-medium text-gray-500 hover:text-black transition-colors"
                        >
                            {isRegister
                                ? "Already have an account? Sign in"
                                : "Don't have an account? Create one"}
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-400 mt-5">
                    Compare AI responses side by side - OpenAI - Gemini - Claude - Grok - Ollama
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <LoginPageContent />
        </Suspense>
    );
}
