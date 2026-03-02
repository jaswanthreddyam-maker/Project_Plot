import { useNetworkStore } from "@/store/networkStore";
import type { ApiErrorPayload } from "@/types/api";

/**
 * Centralized API configuration.
 * Uses NEXT_PUBLIC_API_URL when provided.
 * In local dev, defaults to 127.0.0.1 to avoid localhost/IPv6 mismatches
 * when backend is bound to 127.0.0.1.
 * In production, no localhost fallback is used.
 */
function resolveApiBase(): string {
    const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (configured) {
        return configured.replace(/\/+$/, "");
    }

    return "";
}

export const API_BASE = resolveApiBase();

const OFFLINE_MESSAGE = "Backend Offline: Reconnecting...";
let globalFetchInterceptorsInitialized = false;

function getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("plot_auth_token");
}

function resolveRequestUrl(input: RequestInfo | URL): string {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    return input.url;
}

function isApiRequest(url: string): boolean {
    if (url.startsWith("/api/")) return true;
    if (url === "/api") return true;
    if (API_BASE && (url.startsWith(`${API_BASE}/api/`) || url === `${API_BASE}/api`)) {
        return true;
    }

    if (typeof window !== "undefined") {
        const sameOriginApiPrefix = `${window.location.origin}/api/`;
        if (url.startsWith(sameOriginApiPrefix) || url === `${window.location.origin}/api`) {
            return true;
        }
    }

    return false;
}

function markBackendOffline(message = OFFLINE_MESSAGE): void {
    if (typeof window === "undefined") return;
    useNetworkStore.getState().setBackendOffline(true, message);
}

function clearBackendOffline(): void {
    if (typeof window === "undefined") return;
    useNetworkStore.getState().clearBackendOffline();
}

function getErrorName(error: unknown): string | null {
    if (!error || typeof error !== "object" || !("name" in error)) {
        return null;
    }
    const name = (error as { name?: unknown }).name;
    return typeof name === "string" ? name : null;
}

function mergeHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
    const headers = new Headers();

    // 🚀 FIX: Idhi add cheyakapothe malli CORS or Ngrok page daggara hang avthundhi
    headers.set("ngrok-skip-browser-warning", "true");

    if (input instanceof Request) {
        input.headers.forEach((value, key) => headers.set(key, value));
    }
    if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    return headers;
}

function withAuthHeader(
    input: RequestInfo | URL,
    init?: RequestInit
): { input: RequestInfo | URL; init?: RequestInit } {
    const url = resolveRequestUrl(input);
    const token = getAuthToken();
    if (!token || !isApiRequest(url)) {
        return { input, init };
    }

    const headers = mergeHeaders(input, init);
    if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    if (input instanceof Request) {
        return {
            input: new Request(input, { ...init, headers }),
            init: undefined,
        };
    }

    return {
        input,
        init: { ...init, headers },
    };
}

export function initializeApiInterceptors(): void {
    if (typeof window === "undefined" || globalFetchInterceptorsInitialized) return;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = resolveRequestUrl(input);

        // 🚀 FIX: Bypass interceptor for NextAuth internal calls so it doesn't hang!
        const isNextAuthRoute = requestUrl.includes("/api/auth/signin") || requestUrl.includes("/api/auth/callback") || requestUrl.includes("/api/auth/csrf") || requestUrl.includes("/api/auth/providers") || requestUrl.includes("/api/auth/session");
        if (isNextAuthRoute) {
            return nativeFetch(input, init);
        }

        const targetIsApi = isApiRequest(requestUrl);
        const prepared = withAuthHeader(input, init);

        try {
            const response = await nativeFetch(prepared.input, prepared.init);
            if (targetIsApi && (response.status === 502 || response.status === 503)) {
                markBackendOffline();
            } else if (targetIsApi) {
                clearBackendOffline();
            }
            if (response.status === 401 && typeof window !== "undefined") {
                localStorage.removeItem("plot_auth_token");
                window.location.href = "/login";
            }
            return response;
        } catch (error: unknown) {
            const errorName = getErrorName(error);
            if (targetIsApi && (errorName === "TypeError" || errorName === "AbortError")) {
                markBackendOffline();
            }
            throw error;
        }
    };
    globalFetchInterceptorsInitialized = true;
}

/**
 * Fetch wrapper that adds explicit timeout support.
 * Default timeout is 10000ms.
 */
export async function fetchWithTimeout(
    resource: RequestInfo | URL,
    options: RequestInit & { timeout?: number } = {}
) {
    const { timeout = 10000, ...rest } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // 🚀 FIX: Automatically route Python backend calls to Ngrok/Cloud URL
    let finalUrl = typeof resource === "string" ? resource : resource instanceof URL ? resource.toString() : resource.url;

    const isNextAuthRoute = finalUrl.includes("/api/auth/signin") || finalUrl.includes("/api/auth/callback") || finalUrl.includes("/api/auth/csrf") || finalUrl.includes("/api/auth/providers") || finalUrl.includes("/api/auth/session");

    // If it's a backend call (like /api/auth/google for python) add the API_BASE
    if (finalUrl.startsWith("/api/") && !isNextAuthRoute && API_BASE) {
        finalUrl = `${API_BASE}${finalUrl}`;
    }

    try {
        const response = await fetch(finalUrl, {
            ...rest,
            signal: controller.signal,
        });

        if (response.status === 502 || response.status === 503) {
            markBackendOffline();
        } else {
            clearBackendOffline();
        }

        return response;
    } catch (error: unknown) {
        const errorName = getErrorName(error);
        if (errorName === "AbortError") {
            markBackendOffline("Backend Offline: Request timed out.");
            throw new Error(`Request timed out after ${timeout}ms`);
        }
        if (errorName === "TypeError") {
            markBackendOffline();
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function readErrorMessage(
    response: Response,
    fallback: string
): Promise<string> {
    try {
        const payload = (await response.json()) as ApiErrorPayload;
        return payload.detail || payload.error || payload.message || fallback;
    } catch {
        return fallback;
    }
}

if (typeof window !== "undefined") {
    initializeApiInterceptors();
}
