"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

const TOKEN_KEY = "plot_auth_token";
const TOKEN_SYNC_EVENT = "plot-backend-token-synced";

function decodeBase64Url(input: string): string | null {
    try {
        const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
        return atob(padded);
    } catch {
        return null;
    }
}

function parseTokenPayload(token: string): { sub?: string; exp?: number } | null {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payloadRaw = decodeBase64Url(parts[1]);
    if (!payloadRaw) return null;

    try {
        return JSON.parse(payloadRaw) as { sub?: string; exp?: number };
    } catch {
        return null;
    }
}

export function isBackendTokenValidForUser(
    token: string | null,
    email: string | null
): boolean {
    if (!token || !email) return false;
    const payload = parseTokenPayload(token);
    if (!payload?.sub || typeof payload.sub !== "string") return false;
    if (payload.sub.toLowerCase() !== email.toLowerCase()) return false;
    if (typeof payload.exp !== "number") return false;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now + 30;
}

function broadcastTokenSynced() {
    window.dispatchEvent(new Event(TOKEN_SYNC_EVENT));
}

export function BackendTokenSync() {
    const { status, data } = useSession();
    const email = useMemo(
        () => data?.user?.email?.trim().toLowerCase() || null,
        [data?.user?.email]
    );
    const syncingRef = useRef(false);

    const syncToken = useCallback(async () => {
        if (typeof window === "undefined") return;
        if (status !== "authenticated" || !email || syncingRef.current) return;

        const existing = localStorage.getItem(TOKEN_KEY);
        if (isBackendTokenValidForUser(existing, email)) {
            broadcastTokenSynced();
            return;
        }

        syncingRef.current = true;
        try {
            const res = await fetch("/api/auth/backend-token", {
                method: "GET",
                cache: "no-store",
                credentials: "same-origin",
            });

            if (!res.ok) return;

            const payload = (await res.json()) as { access_token?: unknown };
            const nextToken =
                typeof payload?.access_token === "string" ? payload.access_token : "";
            if (!nextToken) return;

            localStorage.setItem(TOKEN_KEY, nextToken);
            broadcastTokenSynced();
        } finally {
            syncingRef.current = false;
        }
    }, [email, status]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (status === "unauthenticated") {
            localStorage.removeItem(TOKEN_KEY);
            return;
        }
        void syncToken();
    }, [status, syncToken]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (status !== "authenticated") return;

        const intervalId = window.setInterval(() => {
            void syncToken();
        }, 60_000);

        return () => window.clearInterval(intervalId);
    }, [status, syncToken]);

    return null;
}

export function BackendTokenGate({ children }: { children: React.ReactNode }) {
    const { status, data } = useSession();
    const email = useMemo(
        () => data?.user?.email?.trim().toLowerCase() || null,
        [data?.user?.email]
    );
    const [, forceRefresh] = useState(0);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const refresh = () => forceRefresh((value) => value + 1);
        window.addEventListener(TOKEN_SYNC_EVENT, refresh);
        window.addEventListener("storage", refresh);
        return () => {
            window.removeEventListener(TOKEN_SYNC_EVENT, refresh);
            window.removeEventListener("storage", refresh);
        };
    }, []);

    let ready = false;
    if (status === "loading") {
        ready = false;
    } else if (status !== "authenticated") {
        ready = true;
    } else if (typeof window !== "undefined") {
        const token = localStorage.getItem(TOKEN_KEY);
        ready = isBackendTokenValidForUser(token, email);
    }

    if (!ready) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#171717]">
                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    Initializing secure backend session...
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
