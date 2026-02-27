/**
 * Zustand Chat Store
 *
 * Manages live text streams, image fan-out streams, and per-prompt
 * response sets so the workspace can render multiple result groups.
 */

import { create } from "zustand";

export interface ProviderStream {
    isStreaming: boolean;
    currentText: string;
    error: string | null;
}

export interface ConversationMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    provider: string;
    batchId?: string;
    refereeSummary?: string;
    timestamp?: number;
}

export interface GeneratedImage {
    id: string;
    dataUrl: string;
    revisedPrompt: string | null;
}

export interface ProviderImageState {
    status: "idle" | "streaming" | "done" | "error";
    images: GeneratedImage[];
    error: string | null;
}

export interface RefereeState {
    status: "idle" | "waiting" | "streaming" | "done" | "error";
    summary: string;
    error: string | null;
    provider: string | null;
}

export interface ResponseSet {
    id: string;
    prompt: string;
    mode: "text" | "image";
    createdAt: number;
    providers: string[];
    responses: Record<string, ProviderStream>;
    images: Record<string, ProviderImageState>;
    referee: RefereeState;
}

interface ChatState {
    streams: Record<string, ProviderStream>;
    messages: ConversationMessage[];
    conversationId: string | null;

    responseSets: ResponseSet[];
    activeResponseSetId: string | null;

    initializeStream: (provider: string, responseSetId?: string) => void;
    appendToken: (provider: string, chunk: string, responseSetId?: string) => void;
    finalizeStream: (provider: string, responseSetId?: string) => void;
    setStreamError: (provider: string, error: string, responseSetId?: string) => void;

    startResponseSet: (payload: {
        prompt: string;
        mode: "text" | "image";
        providers: string[];
    }) => string;

    initializeImageProvider: (responseSetId: string, provider: string) => void;
    addImageFrame: (
        responseSetId: string,
        provider: string,
        image: GeneratedImage
    ) => void;
    finalizeImageProvider: (responseSetId: string, provider: string) => void;
    setImageProviderError: (
        responseSetId: string,
        provider: string,
        error: string
    ) => void;

    setRefereeStatus: (
        responseSetId: string,
        status: RefereeState["status"],
        provider?: string | null
    ) => void;
    setRefereeSummary: (
        responseSetId: string,
        summary: string,
        provider: string
    ) => void;
    setRefereeError: (responseSetId: string, error: string) => void;

    addMessage: (message: ConversationMessage) => void;
    setMessages: (messages: ConversationMessage[]) => void;
    setResponseSets: (responseSets: ResponseSet[]) => void;
    clearMessages: () => void;

    setConversationId: (id: string | null) => void;
    clearStreams: () => void;

    verdictStatus: "idle" | "waiting" | "streaming" | "done" | "error";
    setVerdictStatus: (status: "idle" | "waiting" | "streaming" | "done" | "error") => void;
}

const emptyStream = (): ProviderStream => ({
    isStreaming: false,
    currentText: "",
    error: null,
});

const emptyReferee = (): RefereeState => ({
    status: "idle",
    summary: "",
    error: null,
    provider: null,
});

function resolveSetId(explicitId: string | undefined, activeId: string | null): string | null {
    return explicitId ?? activeId;
}

function updateResponseSet(
    responseSets: ResponseSet[],
    responseSetId: string | null,
    updater: (set: ResponseSet) => ResponseSet
): ResponseSet[] {
    if (!responseSetId) return responseSets;
    return responseSets.map((set) => (set.id === responseSetId ? updater(set) : set));
}

export const useChatStore = create<ChatState>((set) => ({
    streams: {},
    messages: [],
    conversationId: null,

    responseSets: [],
    activeResponseSetId: null,

    initializeStream: (provider, responseSetId) =>
        set((state) => {
            const targetSetId = resolveSetId(responseSetId, state.activeResponseSetId);
            return {
                streams: {
                    ...state.streams,
                    [provider]: {
                        isStreaming: true,
                        currentText: "",
                        error: null,
                    },
                },
                responseSets: updateResponseSet(state.responseSets, targetSetId, (currentSet) => ({
                    ...currentSet,
                    responses: {
                        ...currentSet.responses,
                        [provider]: {
                            isStreaming: true,
                            currentText: "",
                            error: null,
                        },
                    },
                })),
            };
        }),

    appendToken: (provider, chunk, responseSetId) =>
        set((state) => {
            const targetSetId = resolveSetId(responseSetId, state.activeResponseSetId);
            const currentGlobal = state.streams[provider] ?? emptyStream();

            return {
                streams: {
                    ...state.streams,
                    [provider]: {
                        ...currentGlobal,
                        currentText: currentGlobal.currentText + chunk,
                        isStreaming: true,
                    },
                },
                responseSets: updateResponseSet(state.responseSets, targetSetId, (currentSet) => {
                    const current = currentSet.responses[provider] ?? emptyStream();
                    return {
                        ...currentSet,
                        responses: {
                            ...currentSet.responses,
                            [provider]: {
                                ...current,
                                currentText: current.currentText + chunk,
                                isStreaming: true,
                            },
                        },
                    };
                }),
            };
        }),

    finalizeStream: (provider, responseSetId) =>
        set((state) => {
            const targetSetId = resolveSetId(responseSetId, state.activeResponseSetId);
            const currentGlobal = state.streams[provider];

            return {
                streams: currentGlobal
                    ? {
                        ...state.streams,
                        [provider]: {
                            ...currentGlobal,
                            isStreaming: false,
                        },
                    }
                    : state.streams,
                responseSets: updateResponseSet(state.responseSets, targetSetId, (currentSet) => {
                    const current = currentSet.responses[provider];
                    if (!current) return currentSet;

                    return {
                        ...currentSet,
                        responses: {
                            ...currentSet.responses,
                            [provider]: {
                                ...current,
                                isStreaming: false,
                            },
                        },
                    };
                }),
            };
        }),

    setStreamError: (provider, error, responseSetId) =>
        set((state) => {
            const targetSetId = resolveSetId(responseSetId, state.activeResponseSetId);
            const currentGlobal = state.streams[provider] ?? emptyStream();

            return {
                streams: {
                    ...state.streams,
                    [provider]: {
                        ...currentGlobal,
                        isStreaming: false,
                        error,
                    },
                },
                responseSets: updateResponseSet(state.responseSets, targetSetId, (currentSet) => {
                    const current = currentSet.responses[provider] ?? emptyStream();

                    return {
                        ...currentSet,
                        responses: {
                            ...currentSet.responses,
                            [provider]: {
                                ...current,
                                isStreaming: false,
                                error,
                            },
                        },
                    };
                }),
            };
        }),

    startResponseSet: ({ prompt, mode, providers }) => {
        const id = crypto.randomUUID();
        const createdAt = Date.now();

        set((state) => ({
            activeResponseSetId: id,
            streams: {},
            responseSets: [
                ...state.responseSets,
                {
                    id,
                    prompt,
                    mode,
                    createdAt,
                    providers,
                    responses: {},
                    images: {},
                    referee: emptyReferee(),
                },
            ],
        }));

        return id;
    },

    initializeImageProvider: (responseSetId, provider) =>
        set((state) => ({
            responseSets: updateResponseSet(state.responseSets, responseSetId, (currentSet) => ({
                ...currentSet,
                images: {
                    ...currentSet.images,
                    [provider]: {
                        status: "streaming",
                        images: [],
                        error: null,
                    },
                },
            })),
        })),

    addImageFrame: (responseSetId, provider, image) =>
        set((state) => ({
            responseSets: updateResponseSet(state.responseSets, responseSetId, (currentSet) => {
                const existingProvider = currentSet.images[provider] ?? {
                    status: "streaming" as const,
                    images: [],
                    error: null,
                };

                const existingIndex = existingProvider.images.findIndex((it) => it.id === image.id);
                const images =
                    existingIndex === -1
                        ? [...existingProvider.images, image]
                        : existingProvider.images.map((it, idx) => (idx === existingIndex ? image : it));

                return {
                    ...currentSet,
                    images: {
                        ...currentSet.images,
                        [provider]: {
                            ...existingProvider,
                            status: "streaming",
                            images,
                            error: null,
                        },
                    },
                };
            }),
        })),

    finalizeImageProvider: (responseSetId, provider) =>
        set((state) => ({
            responseSets: updateResponseSet(state.responseSets, responseSetId, (currentSet) => {
                const existingProvider = currentSet.images[provider] ?? {
                    status: "idle" as const,
                    images: [],
                    error: null,
                };

                return {
                    ...currentSet,
                    images: {
                        ...currentSet.images,
                        [provider]: {
                            ...existingProvider,
                            status: existingProvider.status === "error" ? "error" : "done",
                        },
                    },
                };
            }),
        })),

    setImageProviderError: (responseSetId, provider, error) =>
        set((state) => ({
            responseSets: updateResponseSet(state.responseSets, responseSetId, (currentSet) => {
                const existingProvider = currentSet.images[provider] ?? {
                    status: "idle" as const,
                    images: [],
                    error: null,
                };

                return {
                    ...currentSet,
                    images: {
                        ...currentSet.images,
                        [provider]: {
                            ...existingProvider,
                            status: "error",
                            error,
                        },
                    },
                };
            }),
        })),

    setRefereeStatus: (responseSetId, status, provider) =>
        set((state) => ({
            responseSets: updateResponseSet(state.responseSets, responseSetId, (currentSet) => ({
                ...currentSet,
                referee: {
                    ...currentSet.referee,
                    status,
                    provider: provider ?? currentSet.referee.provider,
                    error: status === "error" ? currentSet.referee.error : null,
                },
            })),
        })),

    setRefereeSummary: (responseSetId, summary, provider) =>
        set((state) => ({
            responseSets: updateResponseSet(state.responseSets, responseSetId, (currentSet) => ({
                ...currentSet,
                referee: {
                    status: "done",
                    summary,
                    error: null,
                    provider,
                },
            })),
        })),

    setRefereeError: (responseSetId, error) =>
        set((state) => ({
            responseSets: updateResponseSet(state.responseSets, responseSetId, (currentSet) => ({
                ...currentSet,
                referee: {
                    ...currentSet.referee,
                    status: "error",
                    error,
                },
            })),
        })),

    addMessage: (message) =>
        set((state) => ({
            messages: [...state.messages, message],
        })),

    setMessages: (messages) => set({ messages }),
    setResponseSets: (responseSets) =>
        set({
            responseSets,
            activeResponseSetId: responseSets.length ? responseSets[responseSets.length - 1].id : null,
            streams: {},
            verdictStatus: "idle",
        }),
    clearMessages: () => set({ messages: [], responseSets: [], activeResponseSetId: null }),

    setConversationId: (id) => set({ conversationId: id }),

    clearStreams: () => set({ streams: {}, verdictStatus: "idle" }),

    verdictStatus: "idle",
    setVerdictStatus: (verdictStatus) => set({ verdictStatus }),
}));

export const selectStreamText = (provider: string) => (state: ChatState) =>
    state.streams[provider]?.currentText ?? "";

export const selectStreamStatus = (provider: string) => (state: ChatState) =>
    state.streams[provider]?.isStreaming ?? false;

export const selectStreamError = (provider: string) => (state: ChatState) =>
    state.streams[provider]?.error ?? null;
