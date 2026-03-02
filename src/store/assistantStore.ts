import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { subscribeWithSelector } from "zustand/middleware";
import type { AIMessage, AutomationCommand } from "@/app/lib/schema";

type AssistantSurface = "chat" | "modal" | null;

export interface AssistantState {
    isAssistantActive: boolean;
    assistantSurface: AssistantSurface;
    toggleAssistant: () => void;
    setAssistantActive: (active: boolean) => void;
    openAssistantChat: () => void;
    openAssistantModal: () => void;
    closeAssistant: () => void;

    chatHistory: AIMessage[];
    addMessage: (msg: AIMessage) => void;
    updateMessageContent: (messageId: string, content: string) => void;
    clearHistory: () => void;

    commandQueue: AutomationCommand[];
    isProcessingCommand: boolean;
    enqueueCommand: (cmd: AutomationCommand) => void;
    enqueueCommands: (cmds: AutomationCommand[]) => void;
    dequeueCommand: () => AutomationCommand | undefined;
    setProcessing: (processing: boolean) => void;
    clearCommandQueue: () => void;

    isStreaming: boolean;
    setStreaming: (streaming: boolean) => void;

    telemetrySessionId: string;
    resetTelemetrySession: () => void;

    submitFeedback: (messageId: string, type: "positive" | "negative") => void;
}

export const useAssistantStore = create<AssistantState>()(
    subscribeWithSelector(
        immer((set, get) => ({
            isAssistantActive: false,
            assistantSurface: null,

            toggleAssistant: () =>
                set((state) => {
                    if (state.isAssistantActive) {
                        state.isAssistantActive = false;
                        state.assistantSurface = null;
                    } else {
                        state.isAssistantActive = true;
                        state.assistantSurface = "chat";
                    }
                }),

            setAssistantActive: (active: boolean) =>
                set((state) => {
                    state.isAssistantActive = active;
                    if (!active) {
                        state.assistantSurface = null;
                    } else if (state.assistantSurface === null) {
                        state.assistantSurface = "chat";
                    }
                }),

            openAssistantChat: () =>
                set((state) => {
                    state.isAssistantActive = true;
                    state.assistantSurface = "chat";
                }),

            openAssistantModal: () =>
                set((state) => {
                    state.isAssistantActive = true;
                    state.assistantSurface = "modal";
                }),

            closeAssistant: () =>
                set((state) => {
                    state.isAssistantActive = false;
                    state.assistantSurface = null;
                }),

            chatHistory: [],

            addMessage: (msg: AIMessage) =>
                set((state) => {
                    state.chatHistory.push(msg);
                }),

            updateMessageContent: (messageId: string, content: string) =>
                set((state) => {
                    const message = state.chatHistory.find((msg) => msg.id === messageId);
                    if (message) {
                        message.content = content;
                    }
                }),

            clearHistory: () =>
                set((state) => {
                    state.chatHistory = [];
                }),

            commandQueue: [],
            isProcessingCommand: false,

            enqueueCommand: (cmd: AutomationCommand) =>
                set((state) => {
                    state.commandQueue.push(cmd);
                }),

            enqueueCommands: (cmds: AutomationCommand[]) =>
                set((state) => {
                    state.commandQueue.push(...cmds);
                }),

            dequeueCommand: () => {
                const currentQueue = get().commandQueue;
                if (currentQueue.length === 0) return undefined;
                const first = currentQueue[0];
                set((state) => {
                    state.commandQueue.splice(0, 1);
                });
                return first;
            },

            setProcessing: (processing: boolean) =>
                set((state) => {
                    state.isProcessingCommand = processing;
                }),

            clearCommandQueue: () =>
                set((state) => {
                    state.commandQueue = [];
                    state.isProcessingCommand = false;
                }),

            isStreaming: false,

            setStreaming: (streaming: boolean) =>
                set((state) => {
                    state.isStreaming = streaming;
                }),

            telemetrySessionId: crypto.randomUUID(),

            resetTelemetrySession: () =>
                set((state) => {
                    state.telemetrySessionId = crypto.randomUUID();
                }),

            submitFeedback: (messageId: string, type: "positive" | "negative") =>
                set((state) => {
                    const message = state.chatHistory.find((msg) => msg.id === messageId);
                    if (message) {
                        message.feedback = type;
                    }
                }),
        }))
    )
);

export const selectIsAssistantActive = (s: AssistantState) => s.isAssistantActive;
export const selectChatHistory = (s: AssistantState) => s.chatHistory;
export const selectCommandQueue = (s: AssistantState) => s.commandQueue;
export const selectIsProcessing = (s: AssistantState) => s.isProcessingCommand;
export const selectIsStreaming = (s: AssistantState) => s.isStreaming;
export const selectQueueLength = (s: AssistantState) => s.commandQueue.length;
