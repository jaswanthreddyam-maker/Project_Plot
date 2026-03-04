/**
 * Sidebar — Chat history, search, new chat, clear history with confirmation
 */
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useUIStore } from "@/store/uiStore";
import {
    ConversationMessage,
    ProviderImageState,
    ResponseSet,
    useChatStore,
} from "@/store/chatStore";
import { fetchWithTimeout } from "@/lib/api";

const TEXT_ASSISTANT_PROVIDERS = new Set([
    "openai",
    "gemini",
    "claude",
    "grok",
    "ollama",
]);
const IMAGE_FALLBACK_PROVIDERS = ["openai", "grok"];
const IMAGE_RESULT_PREFIX = "__PLOT_IMAGE_JSON__:";

function looksLikeImagePrompt(prompt: string): boolean {
    const normalized = prompt.trim().toLowerCase();
    if (!normalized) return false;

    if (
        normalized.startsWith("/image ") ||
        normalized.startsWith("/img ") ||
        normalized.startsWith("image:") ||
        normalized.startsWith("draw:")
    ) {
        return true;
    }

    const imageKeywords = [
        "generate image",
        "create image",
        "make image",
        "draw",
        "illustration",
        "photo",
        "picture",
        "poster",
        "logo",
        "artwork",
    ];

    return imageKeywords.some((keyword) => normalized.includes(keyword));
}

function buildResponseSets(
    messages: ConversationMessage[],
    fallbackProviders: string[]
): ResponseSet[] {
    const grouped = new Map<string, ConversationMessage[]>();

    messages.forEach((message) => {
        const key = message.batchId || `single-${message.id}`;
        const existing = grouped.get(key);
        if (existing) {
            existing.push(message);
        } else {
            grouped.set(key, [message]);
        }
    });

    return Array.from(grouped.entries()).map(([batchId, rows]) => {
        const userMessage = rows.find((row) => row.role === "user");
        const prompt = userMessage?.content?.trim() || "Untitled prompt";
        const promptCreatedAt = userMessage?.timestamp ?? Date.now();

        const assistantRows = rows.filter(
            (row) => row.role === "assistant" && TEXT_ASSISTANT_PROVIDERS.has(row.provider)
        );
        const responseMap: Record<
            string,
            { isStreaming: boolean; currentText: string; error: string | null }
        > = {};
        const imageMap: Record<string, ProviderImageState> = {};
        const textProviders: string[] = [];
        const imageProviders: string[] = [];

        assistantRows.forEach((row) => {
            if (row.content.startsWith(IMAGE_RESULT_PREFIX)) {
                const payloadText = row.content.slice(IMAGE_RESULT_PREFIX.length);
                try {
                    const payload = JSON.parse(payloadText) as {
                        images?: Array<{
                            id: string;
                            dataUrl: string;
                            revisedPrompt: string | null;
                        }>;
                    };
                    const images = Array.isArray(payload?.images)
                        ? payload.images.filter(
                            (image) =>
                                typeof image?.id === "string" &&
                                typeof image?.dataUrl === "string"
                        )
                        : [];

                    imageMap[row.provider] = {
                        status: "done",
                        images,
                        error: null,
                    };

                    if (!imageProviders.includes(row.provider)) {
                        imageProviders.push(row.provider);
                    }
                } catch {
                    imageMap[row.provider] = {
                        status: "error",
                        images: [],
                        error: "Failed to parse persisted image payload.",
                    };
                    if (!imageProviders.includes(row.provider)) {
                        imageProviders.push(row.provider);
                    }
                }

                return;
            }

            const previous = responseMap[row.provider];
            responseMap[row.provider] = {
                isStreaming: false,
                currentText: previous
                    ? `${previous.currentText}\n\n${row.content}`
                    : row.content,
                error: null,
            };

            if (!textProviders.includes(row.provider)) {
                textProviders.push(row.provider);
            }
        });

        const refereeRow = rows.find(
            (row) => row.role === "assistant" && row.provider === "referee"
        );
        const inheritedSummary = assistantRows.find(
            (row) => row.refereeSummary && row.refereeSummary.trim().length > 0
        )?.refereeSummary;
        const refereeSummary = refereeRow?.content?.trim() || inheritedSummary || "";
        const inferredMode =
            imageProviders.length > 0
                ? "image"
                : textProviders.length > 0
                    ? "text"
                    : looksLikeImagePrompt(prompt)
                        ? "image"
                        : "text";

        const responseSetProviders =
            inferredMode === "image"
                ? (imageProviders.length > 0 ? imageProviders : IMAGE_FALLBACK_PROVIDERS)
                : textProviders.length > 0
                    ? textProviders
                    : (fallbackProviders.length ? fallbackProviders : ["openai"]);

        const finalImages =
            inferredMode === "image"
                ? responseSetProviders.reduce<Record<string, ProviderImageState>>((acc, provider) => {
                    acc[provider] = imageMap[provider] ?? {
                        status: "idle",
                        images: [],
                        error: null,
                    };
                    return acc;
                }, {})
                : {};

        return {
            id: batchId,
            prompt,
            mode: inferredMode,
            createdAt: promptCreatedAt,
            providers: responseSetProviders,
            responses: responseMap,
            images: finalImages,
            referee: {
                status: inferredMode === "text" && refereeSummary ? "done" : "idle",
                summary: inferredMode === "text" ? refereeSummary : "",
                error: null,
                provider: inferredMode === "text" && refereeRow ? "referee" : null,
            },
        };
    });
}

export default function Sidebar() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const displayTheme = theme === "system" ? resolvedTheme : theme;

    const {
        sidebarCollapsed,
        setSidebarCollapsed,
        conversations,
        setConversations,
        setSettingsOpen,
        clearConversations,
        removeConversation,
        addConversation,
        activeProviders,
    } = useUIStore();
    const {
        messages,
        setMessages,
        setResponseSets,
        clearMessages,
        clearStreams,
        setConversationId,
        streams,
        conversationId,
    } = useChatStore();

    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const settingsMenuRef = useRef<HTMLDivElement>(null);

    // Auto-focus search when opened
    useEffect(() => {
        if (searchOpen && searchRef.current) {
            searchRef.current.focus();
        }
    }, [searchOpen]);

    // Close settings popover when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
                setSettingsMenuOpen(false);
            }
        }
        if (settingsMenuOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [settingsMenuOpen]);

    useEffect(() => {
        let cancelled = false;

        const loadConversations = async () => {
            try {
                const res = await fetchWithTimeout("/api/conversations");
                if (!res.ok) return;

                const payload = await res.json().catch(() => ({}));
                const incoming = Array.isArray(payload?.conversations)
                    ? payload.conversations
                    : [];

                if (cancelled) return;

                setConversations(
                    incoming.map((c: { id?: string; title?: string; updatedAt?: string }) => ({
                        id: c.id || crypto.randomUUID(),
                        title: c.title || "New Chat",
                        updatedAt: c.updatedAt || new Date().toISOString(),
                    }))
                );
            } catch {
                // Keep local state when fetch fails.
            }
        };

        void loadConversations();
        return () => {
            cancelled = true;
        };
    }, [setConversations]);

    const handleNewChat = () => {
        // Save current chat to history if it has messages
        const hasContent = messages.length > 0 ||
            Object.values(streams).some((s) => s.currentText.trim().length > 0);

        if (hasContent) {
            const firstUserMsg = messages.find((m) => m.role === "user");
            const title = firstUserMsg
                ? firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? "..." : "")
                : "New Chat";

            addConversation({
                id: conversationId || crypto.randomUUID(),
                title,
                updatedAt: new Date().toISOString(),
            });
        }

        clearMessages();
        clearStreams();
        setConversationId(null);
    };

    const handleClearHistory = async () => {
        try {
            await fetchWithTimeout("/api/conversations", { method: "DELETE" });
        } catch {
            // Still clear local state so UI remains responsive.
        }

        clearConversations();
        clearMessages();
        clearStreams();
        setConversationId(null);
        setConfirmClear(false);
    };

    const handleDeleteConversation = async (id: string) => {
        try {
            await fetchWithTimeout(`/api/conversations/${id}`, { method: "DELETE" });
        } catch {
            // Keep local delete behavior even if backend request fails.
        }

        removeConversation(id);

        if (conversationId === id) {
            clearMessages();
            clearStreams();
            setConversationId(null);
        }
    };

    const handleOpenConversation = async (id: string) => {
        try {
            const res = await fetchWithTimeout(`/api/conversations/${id}/messages`);
            if (!res.ok) return;

            const payload = await res.json().catch(() => ({}));
            const rows = Array.isArray(payload?.messages) ? payload.messages : [];

            const nextMessages: ConversationMessage[] = rows
                .filter(
                    (row: {
                        id?: string;
                        role?: string;
                        content?: string;
                        provider?: string;
                    }) =>
                        typeof row?.id === "string" &&
                        (row.role === "user" || row.role === "assistant") &&
                        typeof row.content === "string" &&
                        typeof row.provider === "string"
                )
                .map(
                    (row: {
                        id: string;
                        role: "user" | "assistant";
                        content: string;
                        provider: string;
                        batchId?: string | null;
                        refereeSummary?: string | null;
                        createdAt?: string;
                    }) => ({
                        id: row.id,
                        role: row.role,
                        content: row.content,
                        provider: row.provider,
                        batchId: row.batchId || undefined,
                        refereeSummary: row.refereeSummary || undefined,
                        timestamp: row.createdAt ? new Date(row.createdAt).getTime() : undefined,
                    })
                );

            const responseSets = buildResponseSets(nextMessages, activeProviders);

            setConversationId(id);
            setMessages(nextMessages);
            setResponseSets(responseSets);
            clearStreams();
        } catch {
            // Keep current conversation state if open fails.
        }
    };

    const filtered = conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <>
            <aside
                className={`
                    flex flex-col h-full bg-white dark:bg-[#1e1f22] border-r border-gray-200 dark:border-[#333639]
                    transition-all duration-300 ease-in-out
                    ${sidebarCollapsed ? "w-0 overflow-hidden" : "w-64"}
                `}
            >
                {/* ── Top Bar: Hamburger + New Chat + Search ──────── */}
                <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-100 dark:border-[#333639]">
                    {/* Hamburger */}
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#282a2c] transition-colors"
                        title="Toggle sidebar"
                        suppressHydrationWarning
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 dark:text-[#c4c7c5]">
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>

                    {/* New Chat */}
                    <button
                        onClick={handleNewChat}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                        suppressHydrationWarning
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        New Chat
                    </button>

                    {/* Search toggle */}
                    <button
                        onClick={() => {
                            setSearchOpen(!searchOpen);
                            if (searchOpen) setSearchQuery("");
                        }}
                        className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#282a2c] transition-colors ml-auto ${searchOpen ? "bg-gray-100 dark:bg-[#282a2c]" : ""}`}
                        title="Search conversations"
                        suppressHydrationWarning
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 dark:text-[#c4c7c5]">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </button>
                </div>

                {/* ── Search Input (slides open) ────────────────── */}
                {searchOpen && (
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-[#333639]">
                        <div className="relative">
                            <input
                                ref={searchRef}
                                type="text"
                                name="sidebar-search"
                                autoComplete="off"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search chats..."
                                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 text-gray-700 placeholder-gray-400 transition-colors dark:border-[#333639] dark:bg-[#1e1f22] dark:text-[#e3e3e3] dark:placeholder:text-[#c4c7c5]"
                                suppressHydrationWarning
                            />
                            {/* Search icon inside input */}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#c4c7c5]">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            {/* Clear search */}
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-[#c4c7c5] dark:hover:text-[#e3e3e3]"
                                    suppressHydrationWarning
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Chat History ────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
                    {filtered.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-[#c4c7c5] text-center py-8">
                            {searchQuery
                                ? `No results for "${searchQuery}"`
                                : "No conversations yet"}
                        </p>
                    ) : (
                        <div className="space-y-0.5">
                            {filtered.map((conv) => (
                                <div
                                    key={conv.id}
                                    onClick={() => handleOpenConversation(conv.id)}
                                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${conversationId === conv.id
                                        ? "bg-gray-100 dark:bg-[#282a2c]"
                                        : "hover:bg-gray-50 dark:hover:bg-[#282a2c]"
                                        }`}
                                >
                                    <span className="text-sm text-gray-700 dark:text-[#e3e3e3] truncate flex-1">
                                        {conv.title}
                                    </span>
                                    {/* Delete icon */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-[#282a2c] transition-all"
                                        title="Delete conversation"
                                        suppressHydrationWarning
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 dark:text-[#c4c7c5]">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Clear History ───────────────────────────────── */}
                <div className="px-3 py-2 border-t border-gray-100 dark:border-[#333639]">
                    <button
                        onClick={() => conversations.length > 0 ? setConfirmClear(true) : undefined}
                        disabled={conversations.length === 0}
                        title={conversations.length === 0 ? "No conversation history to clear" : ""}
                        className="w-full py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:border-[#333639] dark:text-[#c4c7c5] dark:hover:bg-[#282a2c]"
                        suppressHydrationWarning
                    >
                        Clear History
                    </button>
                </div>

                {/* ── Settings Popover & Button ───────────────────── */}
                <div className="px-3 py-3 border-t border-gray-100 dark:border-[#333639] relative mt-auto" ref={settingsMenuRef}>
                    {/* Popover Menu */}
                    {settingsMenuOpen && (
                        <div className="absolute bottom-full left-3 mb-2 w-56 bg-white dark:bg-[#1e1f22] border border-gray-200 dark:border-[#333639] rounded-xl shadow-lg py-1 z-50 animate-[paragraphFadeIn_0.15s_ease-out]">
                            {/* API Keys Item */}
                            <button
                                onClick={() => {
                                    setSettingsMenuOpen(false);
                                    setSettingsOpen(true);
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-[#e3e3e3] hover:bg-gray-50 dark:hover:bg-[#282a2c] transition-colors"
                                suppressHydrationWarning
                            >
                                <div className="flex items-center gap-2">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                    </svg>
                                    API Keys
                                </div>
                            </button>

                            <Link
                                href="/autonomous"
                                onClick={() => setSettingsMenuOpen(false)}
                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-[#e3e3e3] hover:bg-gray-50 dark:hover:bg-[#282a2c] transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                        <path d="M2 17l10 5 10-5" />
                                        <path d="M2 12l10 5 10-5" />
                                    </svg>
                                    Plot Autonomous
                                </div>
                            </Link>

                            {/* Theme Item with Hover Submenu */}
                            <div className="relative group/theme-item">
                                <button
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-[#e3e3e3] hover:bg-gray-50 dark:hover:bg-[#282a2c] transition-colors"
                                    suppressHydrationWarning
                                >
                                    <div className="flex items-center gap-2">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="5" />
                                            <line x1="12" y1="1" x2="12" y2="3" />
                                            <line x1="12" y1="21" x2="12" y2="23" />
                                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                            <line x1="1" y1="12" x2="3" y2="12" />
                                            <line x1="21" y1="12" x2="23" y2="12" />
                                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                        </svg>
                                        Theme
                                    </div>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </button>

                                {/* Vertically-aligned Submenu */}
                                <div className="absolute left-full top-0 ml-1 w-32 bg-white dark:bg-[#1e1f22] border border-gray-200 dark:border-[#333639] rounded-xl shadow-lg py-1 z-50 opacity-0 invisible group-hover/theme-item:opacity-100 group-hover/theme-item:visible transition-all duration-200">
                                    <button
                                        onClick={() => setTheme("light")}
                                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-[#e3e3e3] hover:bg-gray-50 dark:hover:bg-[#282a2c] transition-colors"
                                        suppressHydrationWarning
                                    >
                                        Light {displayTheme === "light" && <span className="text-xs">✓</span>}
                                    </button>
                                    <button
                                        onClick={() => setTheme("dark")}
                                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-[#e3e3e3] hover:bg-gray-50 dark:hover:bg-[#282a2c] transition-colors"
                                        suppressHydrationWarning
                                    >
                                        Dark {displayTheme === "dark" && <span className="text-xs">✓</span>}
                                    </button>
                                    <button
                                        onClick={() => setTheme("system")}
                                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-[#e3e3e3] hover:bg-gray-50 dark:hover:bg-[#282a2c] transition-colors"
                                        suppressHydrationWarning
                                    >
                                        System {theme === "system" && <span className="text-xs">✓</span>}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    localStorage.removeItem("plot_auth_token");
                                    window.location.href = "/login";
                                }}
                                className="w-full flex items-center justify-start gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-[#282a2c] transition-colors mt-1 border-t border-gray-100 dark:border-[#333639]"
                                suppressHydrationWarning
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-0.5">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                    <polyline points="16 17 21 12 16 7"></polyline>
                                    <line x1="21" y1="12" x2="9" y2="12"></line>
                                </svg>
                                Log Out
                            </button>
                        </div>
                    )}

                    {/* Settings Base Trigger Button */}
                    <button
                        onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors ${settingsMenuOpen ? "bg-gray-50 dark:bg-[#282a2c]" : "hover:bg-gray-50 dark:hover:bg-[#282a2c]"
                            }`}
                        suppressHydrationWarning
                    >
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-[#333639] dark:to-[#282a2c] flex items-center justify-center shrink-0 border border-gray-200 dark:border-[#333639]">
                            <span className="text-[10px] font-bold text-gray-600 dark:text-[#e3e3e3]">⚙</span>
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-[#e3e3e3] truncate">Settings</span>
                    </button>
                </div>
            </aside>

            {/* ── Clear History Confirmation Modal ────────────── */}
            {confirmClear && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">Clear All History?</h3>
                                <p className="text-sm text-gray-500">This cannot be undone.</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-5">
                            This will permanently delete <strong>{conversations.length}</strong> conversation{conversations.length !== 1 ? "s" : ""} from<br /> your sidebar.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmClear(false)}
                                className="flex-1 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearHistory}
                                className="flex-1 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors"
                            >
                                Delete All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
