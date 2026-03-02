"use client";

import { useCallback, useEffect, useState } from "react";

const OLLAMA_HEALTH_URL = "http://localhost:11434/";
const OLLAMA_POLL_INTERVAL_MS = 3000;

type OllamaStatus = "checking" | "online" | "offline";

interface UseOllamaStatusResult {
    status: OllamaStatus;
    isOnline: boolean;
    isOffline: boolean;
    refresh: () => Promise<void>;
}

export function useOllamaStatus(enabled = true): UseOllamaStatusResult {
    const [status, setStatus] = useState<OllamaStatus>("checking");

    const refresh = useCallback(async () => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 1500);

        try {
            const response = await fetch(OLLAMA_HEALTH_URL, {
                method: "GET",
                cache: "no-store",
                signal: controller.signal,
            });
            setStatus(response.ok ? "online" : "offline");
        } catch {
            setStatus("offline");
        } finally {
            window.clearTimeout(timeoutId);
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        const refreshIfMounted = async () => {
            if (cancelled) return;
            await refresh();
        };

        setStatus("checking");
        void refreshIfMounted();

        const intervalId = window.setInterval(() => {
            void refreshIfMounted();
        }, OLLAMA_POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [enabled, refresh]);

    return {
        status,
        isOnline: status === "online",
        isOffline: status === "offline",
        refresh,
    };
}
