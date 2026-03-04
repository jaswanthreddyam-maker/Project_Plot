import { create } from "zustand";

interface NetworkState {
    backendOffline: boolean;
    message: string;
    setBackendOffline: (offline: boolean, message?: string) => void;
    clearBackendOffline: () => void;
    startHealthCheck: () => void;
}

const DEFAULT_MESSAGE = "Backend Offline: Reconnecting...";
const HEALTH_CHECK_INTERVAL_MS = 5_000;

let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

function resolveApiBase(): string {
    const raw = typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_API_URL : undefined;
    const configured = raw?.trim();
    return configured ? configured.replace(/\/+$/, "") : "";
}

function stopHealthCheck(): void {
    if (healthCheckTimer !== null) {
        clearInterval(healthCheckTimer);
        healthCheckTimer = null;
    }
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
    backendOffline: false,
    message: "",
    setBackendOffline: (offline: boolean, message = DEFAULT_MESSAGE) =>
        set({
            backendOffline: offline,
            message: offline ? message : "",
        }),
    clearBackendOffline: () => {
        stopHealthCheck();
        set({ backendOffline: false, message: "" });
    },
    startHealthCheck: () => {
        // Guard: don't start a second polling loop
        if (healthCheckTimer !== null) return;

        const apiBase = resolveApiBase();
        const healthUrl = `${apiBase}/api/health`;

        const poll = async () => {
            try {
                // Use native fetch to bypass our interceptor (avoids recursion)
                const res = await window.fetch(healthUrl, {
                    method: "GET",
                    cache: "no-store",
                    headers: { "ngrok-skip-browser-warning": "true" },
                });
                if (res.ok) {
                    get().clearBackendOffline();
                }
            } catch {
                // Backend still unreachable — keep polling
            }
        };

        healthCheckTimer = setInterval(poll, HEALTH_CHECK_INTERVAL_MS);
    },
}));
