"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-900">
            <div className="text-center">
                <h1 className="mb-8 text-3xl font-bold text-white">Plot</h1>
                <button
                    onClick={() => signIn("google", { callbackUrl: "/workspace" })}
                    className="rounded-lg bg-white px-6 py-3 font-semibold text-black hover:bg-gray-200 transition-colors"
                >
                    Continue with Google
                </button>
            </div>
        </div>
    );
}