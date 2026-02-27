/**
 * Login Page - Clean White Theme + Google OAuth
 */
"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleAvailable, setGoogleAvailable] = useState(false);
    const [formReady, setFormReady] = useState(false);
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const t = setTimeout(() => {
            setFormReady(true);
            setTimeout(() => {
                if (emailRef.current) emailRef.current.value = "";
                if (passwordRef.current) passwordRef.current.value = "";
                setEmail("");
                setPassword("");
            }, 50);
        }, 100);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        fetch("/api/auth/providers")
            .then((r) => r.json())
            .then((data) => setGoogleAvailable(data.google))
            .catch(() => { });
    }, []);

    useEffect(() => {
        const callbackError = searchParams.get("error");
        if (callbackError) {
            const messages: Record<string, string> = {
                OAuthAccountNotLinked:
                    "This email is already registered with a password. Please sign in with your credentials.",
                OAuthSignin: "Could not start Google sign-in. Please try again.",
                OAuthCallback: "Error during Google sign-in. Please try again.",
                default: `Sign-in error: ${callbackError}`,
            };
            setError(messages[callbackError] || messages.default);
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedName = name.trim();

        try {
            if (isRegister) {
                const res = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: normalizedEmail, password, name: normalizedName }),
                });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Registration failed");
                }
            }

            const result = await signIn("credentials", {
                email: normalizedEmail,
                password,
                redirect: false,
            });

            if (result?.error) {
                throw new Error("Invalid credentials");
            }

            router.push("/workspace");
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = () => {
        signIn("google", { callbackUrl: "/workspace" });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="w-full max-w-md mx-4">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
                    <div className="flex justify-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                </svg>
                            </div>
                            <span className="text-2xl font-bold text-gray-900">Plot</span>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 text-center mb-1">
                        {isRegister ? "Create Account" : "Welcome Back"}
                    </h2>
                    <p className="text-sm text-gray-500 text-center mb-6">
                        {isRegister
                            ? "Set up your multi-LLM workspace"
                            : "Sign in to your parallel AI workspace"}
                    </p>

                    {error && (
                        <div className="p-3 mb-5 rounded-lg bg-red-50 border border-red-200">
                            <p className="text-sm text-red-600 text-center">{error}</p>
                        </div>
                    )}

                    {googleAvailable && (
                        <>
                            <button
                                type="button"
                                onClick={handleGoogleSignIn}
                                className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-5"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Continue with Google
                            </button>

                            <div className="flex items-center gap-3 mb-5">
                                <div className="flex-1 h-px bg-gray-200"></div>
                                <span className="text-xs text-gray-400">or</span>
                                <div className="flex-1 h-px bg-gray-200"></div>
                            </div>
                        </>
                    )}

                    {!formReady ? (
                        <div className="space-y-4">
                            <div className="w-full h-[42px] rounded-lg bg-gray-100 animate-pulse" />
                            <div className="w-full h-[42px] rounded-lg bg-gray-100 animate-pulse" />
                            <div className="w-full h-[42px] rounded-lg bg-gray-800 animate-pulse" />
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                            {isRegister && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Your name"
                                        autoComplete="off"
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-[#1a1a1a] placeholder:text-gray-400 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                                <input
                                    ref={emailRef}
                                    type="text"
                                    name="login-email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    autoComplete="off"
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-[#1a1a1a] placeholder:text-gray-400 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
                                <input
                                    ref={passwordRef}
                                    type="password"
                                    name="login-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="........"
                                    required
                                    minLength={8}
                                    autoComplete="off"
                                    data-lpignore="true"
                                    data-1p-ignore
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-[#1a1a1a] placeholder:text-gray-400 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
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

                    <div className="mt-5 text-center">
                        <button
                            onClick={() => {
                                setIsRegister(!isRegister);
                                setError("");
                            }}
                            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
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
