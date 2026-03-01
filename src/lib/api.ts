/**
 * Centralized API configuration.
 * Uses NEXT_PUBLIC_API_URL env var when deployed, falls back to 127.0.0.1 for local dev.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

import { getSession, signOut } from "next-auth/react";

/**
 * Fetch wrapper that adds an explicit timeout to requests.
 * Default timeout is 10000ms (10 seconds).
 */
export async function fetchWithTimeout(resource: RequestInfo | URL, options: RequestInit & { timeout?: number } = {}) {
    const { timeout = 10000 } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const headers = new Headers(options.headers || {});

    // Dynamically retrieve token from NextAuth session or fallback
    let token = null;
    if (typeof window !== "undefined") {
        const session = await getSession();
        token = (session as any)?.accessToken || (session?.user as any)?.id || localStorage.getItem("token");
    }

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    try {
        const response = await fetch(resource, {
            ...options,
            headers,
            signal: controller.signal
        });
        clearTimeout(id);

        if (response.status === 401) {
            console.warn("401 Unauthorized - Redirecting to login");
            if (typeof window !== "undefined") {
                await signOut({ redirect: false });
                localStorage.removeItem("token");
                window.location.href = "/login";
            }
        }

        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout}ms`);
        }
        throw error;
    }
}
