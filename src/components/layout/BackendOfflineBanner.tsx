"use client";

import { useNetworkStore } from "@/store/networkStore";

export default function BackendOfflineBanner() {
    const backendOffline = useNetworkStore((s) => s.backendOffline);
    const message = useNetworkStore((s) => s.message);

    if (!backendOffline) return null;

    return (
        <div className="w-full border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900">
            {message || "Backend Offline: Reconnecting..."}
        </div>
    );
}
