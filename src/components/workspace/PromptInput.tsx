/**
 * PromptInput - Multi-provider fan-out input
 *
 * Supports:
 * - Text prompts -> /api/chat/[provider] + optional referee summary
 * - Image prompts -> /api/generate-images streaming fan-out
 */
"use client";

import { useRef, useState } from "react";
import { useChatStore } from "@/store/chatStore";
import { useUIStore } from "@/store/uiStore";

const IMAGE_PROVIDERS = new Set(["openai", "grok"]);
const REFEREE_PRIORITY = ["gemini", "openai", "claude", "grok"] as const;
const IMAGE_RESULT_PREFIX = "__PLOT_IMAGE_JSON__:";

const CODE_MENTOR_PREFIX =
    "You are an expert Senior Developer. Debug the following code/error, " +
    "explain the root cause simply, and provide the optimized fixed code block:\n\n";


interface PersistableMessage {
    role: "user" | "assistant";
    content: string;
    provider: string;
    batchId?: string;
    refereeSummary?: string;
}

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

export default function PromptInput() {
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const activeProviders = useUIStore((s) => s.activeProviders);
    const comparisonMode = useUIStore((s) => s.comparisonMode);
    const codeMentorMode = useUIStore((s) => s.codeMentorMode);
    const apiKeys = useUIStore((s) => s.apiKeys);
    const addConversation = useUIStore((s) => s.addConversation);
    const conversationId = useChatStore((s) => s.conversationId);
    const setConversationId = useChatStore((s) => s.setConversationId);

    const {
        addMessage,
        startResponseSet,
        initializeStream,
        appendToken,
        finalizeStream,
        setStreamError,
        initializeImageProvider,
        addImageFrame,
        finalizeImageProvider,
        setImageProviderError,
        setRefereeStatus,
        setRefereeSummary,
        setRefereeError,
    } = useChatStore();

    const persistMessages = async (
        targetConversationId: string | null,
        messages: PersistableMessage[]
    ) => {
        if (!targetConversationId || messages.length === 0) return;

        try {
            await fetch(`/api/conversations/${targetConversationId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages }),
            });
        } catch {
            // Persistence is best-effort so chat UX is not blocked.
        }
    };

    const titleFromPrompt = (prompt: string): string =>
        prompt.length > 40 ? `${prompt.slice(0, 40)}...` : prompt;

    const touchConversationSummary = (id: string, prompt: string) => {
        const existing = useUIStore.getState().conversations.find((c) => c.id === id);
        addConversation({
            id,
            title: existing?.title || titleFromPrompt(prompt),
            updatedAt: new Date().toISOString(),
        });
    };

    const ensureConversationId = async (prompt: string): Promise<string | null> => {
        if (conversationId) return conversationId;

        try {
            const response = await fetch("/api/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: prompt.slice(0, 80) || "New Chat",
                }),
            });

            if (!response.ok) return null;

            const payload = await response.json().catch(() => ({}));
            const id = payload?.conversation?.id;
            if (typeof id === "string" && id.length > 0) {
                setConversationId(id);
                touchConversationSummary(id, prompt);
                return id;
            }
            return null;
        } catch {
            return null;
        }
    };

    const runRefereeSummary = async (
        responseSetId: string,
        prompt: string,
        targetConversationId: string | null
    ) => {
        const currentState = useChatStore.getState();
        const currentSet = currentState.responseSets.find((set) => set.id === responseSetId);
        if (!currentSet) return;

        const responses = currentSet.providers
            .map((provider) => ({
                provider,
                content: currentSet.responses[provider]?.currentText?.trim() || "",
            }))
            .filter((row) => row.content.length > 0);

        if (responses.length < 2) {
            setRefereeError(responseSetId, "Need at least two completed responses for referee mode.");
            return;
        }

        const selectedReferee = REFEREE_PRIORITY.find((provider) => !!apiKeys[provider]);
        if (!selectedReferee) {
            setRefereeError(responseSetId, "No API key available for referee provider.");
            return;
        }

        setRefereeStatus(responseSetId, "streaming", selectedReferee);

        try {
            const response = await fetch("/api/chat/referee", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    responses,
                    apiKey: apiKeys[selectedReferee],
                    refereeProvider: selectedReferee,
                    conversationId: targetConversationId || undefined,
                    batchId: responseSetId,
                    codeMentorMode: codeMentorMode || undefined,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || "Referee summary failed.");
            }

            const summary =
                typeof data.summary === "string" ? data.summary.trim() : "";

            if (!summary) {
                throw new Error("Referee returned an empty summary.");
            }

            const refereeProvider =
                typeof data.refereeProvider === "string" && data.refereeProvider
                    ? data.refereeProvider
                    : selectedReferee;

            setRefereeSummary(responseSetId, summary, refereeProvider);

            addMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                content: summary,
                provider: "referee",
                batchId: responseSetId,
                refereeSummary: summary,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Referee summary failed.";
            setRefereeError(responseSetId, message);
        }
    };

    const handleTextPrompt = async (
        responseSetId: string,
        prompt: string,
        targetConversationId: string | null,
        userMessage: PersistableMessage
    ) => {
        if (comparisonMode) {
            setRefereeStatus(responseSetId, "waiting");
        }

        activeProviders.forEach((provider) => initializeStream(provider, responseSetId));

        const streamRuns = activeProviders.map(async (provider) => {
            try {
                const apiKey = apiKeys[provider];
                if (provider !== "ollama" && !apiKey) {
                    throw new Error(`No API key configured for ${provider}.`);
                }

                const response = await fetch(`/api/chat/${provider}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: [{ role: "user", content: codeMentorMode ? CODE_MENTOR_PREFIX + prompt : prompt }],
                        apiKey: apiKey || undefined,
                    }),
                });

                if (!response.ok) {
                    const errorPayload = await response.json().catch(() => ({}));
                    throw new Error(errorPayload.error || `${provider} returned ${response.status}.`);
                }

                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error("No stream available");
                }

                const decoder = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    appendToken(provider, chunk, responseSetId);
                }

                finalizeStream(provider, responseSetId);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown stream error.";
                setStreamError(provider, message, responseSetId);
                finalizeStream(provider, responseSetId);
            }
        });

        await Promise.allSettled(streamRuns);

        const completedSet = useChatStore
            .getState()
            .responseSets.find((set) => set.id === responseSetId);

        if (completedSet) {
            const assistantMessages: PersistableMessage[] = [];
            for (const provider of completedSet.providers) {
                const response = completedSet.responses[provider];
                if (response?.currentText) {
                    const message = {
                        role: "assistant" as const,
                        content: response.currentText,
                        provider,
                        batchId: responseSetId,
                    };

                    addMessage({
                        id: crypto.randomUUID(),
                        ...message,
                    });
                    assistantMessages.push(message);
                }
            }

            await persistMessages(targetConversationId, [userMessage, ...assistantMessages]);
        }

        if (comparisonMode) {
            await runRefereeSummary(responseSetId, prompt, targetConversationId);
        }
    };

    const handleImagePrompt = async (
        responseSetId: string,
        prompt: string
    ): Promise<PersistableMessage[]> => {
        const supportedProviders = activeProviders.filter((provider) =>
            IMAGE_PROVIDERS.has(provider)
        );

        for (const provider of activeProviders) {
            initializeImageProvider(responseSetId, provider);
            if (!IMAGE_PROVIDERS.has(provider)) {
                setImageProviderError(
                    responseSetId,
                    provider,
                    `${provider} is not enabled for image fan-out.`
                );
            }
        }

        if (supportedProviders.length === 0) {
            return [];
        }

        try {
            const response = await fetch("/api/generate-images", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    providers: supportedProviders,
                    apiKeys,
                    options: {
                        count: 2,
                        size: "1024x1024",
                    },
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error || "Image fan-out failed.");
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("No image stream returned.");
            }

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;

                    let event:
                        | {
                            type: string;
                            provider?: string;
                            error?: string;
                            image?: {
                                id: string;
                                dataUrl: string;
                                revisedPrompt: string | null;
                            };
                        }
                        | null = null;
                    try {
                        event = JSON.parse(line) as {
                            type: string;
                            provider?: string;
                            error?: string;
                            image?: {
                                id: string;
                                dataUrl: string;
                                revisedPrompt: string | null;
                            };
                        };
                    } catch {
                        continue;
                    }

                    const provider = event.provider;
                    if (!provider) continue;

                    if (event.type === "provider-start") {
                        initializeImageProvider(responseSetId, provider);
                    } else if (event.type === "provider-error") {
                        setImageProviderError(
                            responseSetId,
                            provider,
                            event.error || "Image provider failed."
                        );
                    } else if (event.type === "image" && event.image?.dataUrl) {
                        addImageFrame(responseSetId, provider, {
                            id: event.image.id,
                            dataUrl: event.image.dataUrl,
                            revisedPrompt: event.image.revisedPrompt ?? null,
                        });
                    } else if (event.type === "provider-done") {
                        finalizeImageProvider(responseSetId, provider);
                    }
                }
            }

            const tail = buffer.trim();
            if (tail) {
                try {
                    const event = JSON.parse(tail) as { type: string; provider?: string };
                    if (event.type === "provider-done" && event.provider) {
                        finalizeImageProvider(responseSetId, event.provider);
                    }
                } catch {
                    // Ignore trailing partial payload.
                }
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Image generation request failed.";
            for (const provider of supportedProviders) {
                setImageProviderError(responseSetId, provider, message);
            }
        }

        const completedSet = useChatStore
            .getState()
            .responseSets.find((set) => set.id === responseSetId);
        if (!completedSet) return [];

        const assistantMessages: PersistableMessage[] = [];
        for (const provider of completedSet.providers) {
            const state = completedSet.images[provider];
            if (!state?.images?.length) continue;

            assistantMessages.push({
                role: "assistant",
                provider,
                batchId: responseSetId,
                content: `${IMAGE_RESULT_PREFIX}${JSON.stringify({
                    images: state.images,
                })}`,
            });
        }

        return assistantMessages;
    };

    const handleSend = async () => {
        const prompt = input.trim();
        if (!prompt || sending || activeProviders.length === 0) return;

        setSending(true);
        setInput("");

        const mode = looksLikeImagePrompt(prompt) ? "image" : "text";
        const responseSetId = startResponseSet({
            prompt,
            mode,
            providers: [...activeProviders],
        });

        const userMessage = {
            role: "user" as const,
            content: prompt,
            provider: "user",
            batchId: responseSetId,
        };
        addMessage({
            id: crypto.randomUUID(),
            ...userMessage,
            timestamp: Date.now(),
        });

        const targetConversationId = await ensureConversationId(prompt);

        try {
            if (mode === "image") {
                const imageAssistantMessages = await handleImagePrompt(responseSetId, prompt);
                await persistMessages(targetConversationId, [userMessage, ...imageAssistantMessages]);
            } else {
                await handleTextPrompt(responseSetId, prompt, targetConversationId, userMessage);
            }

            if (targetConversationId) {
                touchConversationSummary(targetConversationId, prompt);
            }
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    return (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-[#171717] transition-colors">
            <div className="flex items-center gap-3 max-w-4xl mx-auto">
                <input
                    suppressHydrationWarning
                    type="text"
                    name="fake-username-field"
                    autoComplete="username"
                    style={{ display: "none" }}
                    tabIndex={-1}
                    aria-hidden="true"
                />
                <input
                    suppressHydrationWarning
                    type="password"
                    name="fake-password-field"
                    autoComplete="current-password"
                    style={{ display: "none" }}
                    tabIndex={-1}
                    aria-hidden="true"
                />
                <input
                    suppressHydrationWarning
                    ref={inputRef}
                    type="text"
                    name="chat-prompt-input"
                    autoComplete="off"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="Type a message or image prompt"
                    disabled={sending}
                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-gray-400 dark:focus:border-gray-500 disabled:opacity-50 transition-colors"
                />
                <button
                    suppressHydrationWarning
                    onClick={handleSend}
                    disabled={sending || !input.trim() || activeProviders.length === 0}
                    className="px-5 py-2.5 bg-gray-700 dark:bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-gray-600 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    {sending ? "..." : "Send"}
                </button>
            </div>
        </div>
    );
}
