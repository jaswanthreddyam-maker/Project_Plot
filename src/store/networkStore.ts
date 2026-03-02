import { create } from "zustand";

interface NetworkState {
    backendOffline: boolean;
    message: string;
    setBackendOffline: (offline: boolean, message?: string) => void;
    clearBackendOffline: () => void;
}

const DEFAULT_MESSAGE = "Backend Offline: Reconnecting...";

export const useNetworkStore = create<NetworkState>((set) => ({
    backendOffline: false,
    message: "",
    setBackendOffline: (offline: boolean, message = DEFAULT_MESSAGE) =>
        set({
            backendOffline: offline,
            message: offline ? message : "",
        }),
    clearBackendOffline: () => set({ backendOffline: false, message: "" }),
}));
