/**
 * ════════════════════════════════════════════════════════════════
 * Zustand AI Assistant Store — Isolated State Domain
 * ════════════════════════════════════════════════════════════════
 *
 * Completely decoupled from chatStore and uiStore.
 * Manages:
 *   - Chat overlay visibility
 *   - AI conversation history
 *   - FIFO command queue for UI automation
 *   - Processing locks to prevent race conditions
 *   - Streaming state
 *   - Telemetry session binding
 *
 * Uses Immer middleware for deep immutable updates and
 * subscribeWithSelector for granular re-render control.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { subscribeWithSelector } from "zustand/middleware";
import type { AIMessage, AutomationCommand } from "@/app/lib/schema";

// ── State Interface ──────────────────────────────────────────
export interface AssistantState {
    // UI
    isAssistantActive: boolean;
    toggleAssistant: () => void;
    setAssistantActive: (active: boolean) => void;

    // Chat History
    chatHistory: AIMessage[];
    addMessage: (msg: AIMessage) => void;
    clearHistory: () => void;

    // Command Queue (FIFO)
    commandQueue: AutomationCommand[];
    isProcessingCommand: boolean;
    enqueueCommand: (cmd: AutomationCommand) => void;
    enqueueCommands: (cmds: AutomationCommand[]) => void;
    dequeueCommand: () => AutomationCommand | undefined;
    setProcessing: (processing: boolean) => void;
    clearCommandQueue: () => void;

    // Streaming
    isStreaming: boolean;
    setStreaming: (streaming: boolean) => void;

    // Telemetry
    telemetrySessionId: string;
    resetTelemetrySession: () => void;

    // Feedback
    submitFeedback: (messageId: string, type: "positive" | "negative") => void;
}

// ── Store Creation ───────────────────────────────────────────
export const useAssistantStore = create<AssistantState>()(
    subscribeWithSelector(
        immer((set, get) => ({
            // ── UI ───────────────────────────────────────────
            isAssistantActive: false,

            toggleAssistant: () =>
                set((state) => {
                    state.isAssistantActive = !state.isAssistantActive;
                }),

            setAssistantActive: (active: boolean) =>
                set((state) => {
                    state.isAssistantActive = active;
                }),

            // ── Chat History ─────────────────────────────────
            chatHistory: [],

            addMessage: (msg: AIMessage) =>
                set((state) => {
                    state.chatHistory.push(msg);
                }),

            clearHistory: () =>
                set((state) => {
                    state.chatHistory = [];
                }),

            // ── Command Queue ────────────────────────────────
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
                const current = get().commandQueue;
                if (current.length === 0) return undefined;
                const first = current[0];
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

            // ── Streaming ────────────────────────────────────
            isStreaming: false,

            setStreaming: (streaming: boolean) =>
                set((state) => {
                    state.isStreaming = streaming;
                }),

            // ── Telemetry ────────────────────────────────────
            telemetrySessionId: crypto.randomUUID(),

            resetTelemetrySession: () =>
                set((state) => {
                    state.telemetrySessionId = crypto.randomUUID();
                }),

            // ── Feedback ─────────────────────────────────────
            submitFeedback: (messageId: string, type: "positive" | "negative") =>
                set((state) => {
                    const message = state.chatHistory.find(
                        (msg) => msg.id === messageId
                    );
                    if (message) {
                        message.feedback = type;
                    }
                }),
        }))
    )
);

// ── Selectors ────────────────────────────────────────────────
// Granular selectors to prevent unnecessary re-renders.
export const selectIsAssistantActive = (s: AssistantState) => s.isAssistantActive;
export const selectChatHistory = (s: AssistantState) => s.chatHistory;
export const selectCommandQueue = (s: AssistantState) => s.commandQueue;
export const selectIsProcessing = (s: AssistantState) => s.isProcessingCommand;
export const selectIsStreaming = (s: AssistantState) => s.isStreaming;
export const selectQueueLength = (s: AssistantState) => s.commandQueue.length;
