/**
 * ════════════════════════════════════════════════════════════════
 * Zustand UI Store — Application-wide UI State
 * ════════════════════════════════════════════════════════════════
 *
 * Manages sidebar, settings modal, active providers, vault state,
 * API keys, and conversation list.
 *
 * Vault Password: stored as a SHA-256 hex hash in localStorage.
 * API keys: stored in localStorage (dev mode).
 */

import { create } from "zustand";

export type ProviderOption = "openai" | "gemini" | "claude" | "ollama" | "grok";

export interface ConversationSummary {
    id: string;
    title: string;
    updatedAt: string;
}

interface UIState {
    // ── Sidebar ──────────────────────────────────────────
    sidebarCollapsed: boolean;
    toggleSidebar: () => void;
    setSidebarCollapsed: (collapsed: boolean) => void;

    // ── Active Providers ─────────────────────────────────
    activeProviders: ProviderOption[];
    toggleProvider: (provider: ProviderOption) => void;
    setActiveProviders: (providers: ProviderOption[]) => void;

    // ── Settings Modal ───────────────────────────────────
    settingsOpen: boolean;
    setSettingsOpen: (open: boolean) => void;

    // ── Unlock Modal ─────────────────────────────────────
    unlockModalOpen: boolean;
    setUnlockModalOpen: (open: boolean) => void;

    // ── Ollama Setup Modal ───────────────────────────────
    ollamaModalOpen: boolean;
    setOllamaModalOpen: (open: boolean) => void;

    // ── Vault / API Keys ─────────────────────────────────
    isVaultUnlocked: boolean;
    hasVaultPassword: boolean;
    vaultEmail: string | null; // email associated with vault for password reset
    apiKeys: Record<string, string>;
    createVaultPassword: (password: string, email: string) => Promise<void>;
    unlockVault: (password: string) => Promise<boolean>;
    lockVault: () => void;
    resetVaultPassword: (newPassword: string) => Promise<void>;
    setApiKey: (provider: string, key: string) => void;
    removeApiKey: (provider: string) => void;
    getApiKey: (provider: string) => string | undefined;

    // ── Conversations List ───────────────────────────────
    conversations: ConversationSummary[];
    setConversations: (conversations: ConversationSummary[]) => void;
    addConversation: (conversation: ConversationSummary) => void;
    removeConversation: (id: string) => void;
    clearConversations: () => void;

    // ── Smart Comparison Mode ────────────────────────────
    comparisonMode: boolean;
    setComparisonMode: (enabled: boolean) => void;

    // ── Code Mentor Mode ─────────────────────────────────
    codeMentorMode: boolean;
    toggleCodeMentorMode: () => void;
}

// ── LocalStorage helpers ──────────────────────────────────
function loadKeysFromStorage(): Record<string, string> {
    if (typeof window === "undefined") return {};
    try {
        const stored = localStorage.getItem("nexuschat_api_keys");
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

function saveKeysToStorage(keys: Record<string, string>) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem("nexuschat_api_keys", JSON.stringify(keys));
    } catch { /* silent */ }
}

function hasStoredVaultPassword(): boolean {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("nexuschat_vault_hash");
}

function getStoredVaultEmail(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("nexuschat_vault_email");
}

// ── SHA-256 hash using Web Crypto API (deterministic) ─────
async function sha256Hash(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const useUIStore = create<UIState>((set, get) => ({
    // ── Sidebar Defaults ─────────────────────────────────
    sidebarCollapsed: false,
    toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }),

    // ── Providers: all enabled by default ────────────────
    activeProviders: ["openai", "gemini", "claude", "ollama", "grok"],
    toggleProvider: (provider) =>
        set((state) => {
            const isActive = state.activeProviders.includes(provider);
            return {
                activeProviders: isActive
                    ? state.activeProviders.filter((p) => p !== provider)
                    : [...state.activeProviders, provider],
            };
        }),
    setActiveProviders: (providers) =>
        set({ activeProviders: providers }),

    // ── Modals ───────────────────────────────────────────
    settingsOpen: false,
    setSettingsOpen: (open) => set({ settingsOpen: open }),

    unlockModalOpen: false,
    setUnlockModalOpen: (open) => set({ unlockModalOpen: open }),

    ollamaModalOpen: false,
    setOllamaModalOpen: (open) => set({ ollamaModalOpen: open }),

    // ── Vault / API Keys ─────────────────────────────────
    isVaultUnlocked: false, // always locked on page load
    hasVaultPassword: hasStoredVaultPassword(),
    vaultEmail: getStoredVaultEmail(),
    apiKeys: loadKeysFromStorage(),

    createVaultPassword: async (password: string, email: string) => {
        const hash = await sha256Hash(password);
        localStorage.setItem("nexuschat_vault_hash", hash);
        localStorage.setItem("nexuschat_vault_email", email);
        set({ isVaultUnlocked: true, hasVaultPassword: true, vaultEmail: email });
    },

    unlockVault: async (password: string): Promise<boolean> => {
        const storedHash = localStorage.getItem("nexuschat_vault_hash");
        if (!storedHash) return false;
        const inputHash = await sha256Hash(password);
        if (inputHash === storedHash) {
            set({ isVaultUnlocked: true });
            return true;
        }
        return false;
    },

    lockVault: () => {
        set({ isVaultUnlocked: false });
    },

    resetVaultPassword: async (newPassword: string) => {
        const hash = await sha256Hash(newPassword);
        localStorage.setItem("nexuschat_vault_hash", hash);
        set({ isVaultUnlocked: true, hasVaultPassword: true });
    },

    setApiKey: (provider: string, key: string) => {
        const current = get().apiKeys;
        const updated = { ...current, [provider]: key };
        saveKeysToStorage(updated);
        set({ apiKeys: updated });
    },

    removeApiKey: (provider: string) => {
        const current = get().apiKeys;
        const updated = { ...current };
        delete updated[provider];
        saveKeysToStorage(updated);
        set({ apiKeys: updated });
    },

    getApiKey: (provider: string) => {
        return get().apiKeys[provider];
    },

    // ── Conversations ────────────────────────────────────
    conversations: [],
    setConversations: (conversations) => set({ conversations }),
    addConversation: (conversation) =>
        set((state) => ({
            conversations: [
                conversation,
                ...state.conversations.filter((c) => c.id !== conversation.id),
            ],
        })),
    removeConversation: (id) =>
        set((state) => ({
            conversations: state.conversations.filter((c) => c.id !== id),
        })),
    clearConversations: () => set({ conversations: [] }),

    comparisonMode: false,
    setComparisonMode: (comparisonMode) => set({ comparisonMode }),

    codeMentorMode: false,
    toggleCodeMentorMode: () => set((s) => ({ codeMentorMode: !s.codeMentorMode })),
}));
