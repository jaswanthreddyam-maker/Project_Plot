/**
 * ════════════════════════════════════════════════════════════════
 * Mentor Store — Scoped Zustand State for Code Mentor
 * ════════════════════════════════════════════════════════════════
 *
 * Fully isolated from chatStore and assistantStore.
 * Manages: source code, language, LLM explanation steps,
 * Mermaid syntax, expected output, streaming status, and error state.
 */

import { createStore } from "zustand/vanilla";
import type { MentorOutput } from "@/app/lib/mentor-schema";

export interface ExplanationStep {
    heading: string;
    description: string;
}

export interface MentorState {
    // ── Input ─────────────────────────────────────────────
    code: string;
    language: string;

    // ── LLM Output ────────────────────────────────────────
    explanationSteps: ExplanationStep[];
    diagramSyntax: string;
    expectedOutput: string;

    // ── Streaming ─────────────────────────────────────────
    status: "idle" | "analyzing" | "done" | "error";
    error: string | null;
    provider: string | null;

    // ── Actions ───────────────────────────────────────────
    setCode: (code: string) => void;
    setLanguage: (language: string) => void;
    setProvider: (provider: string) => void;
    startAnalysis: () => void;
    setResult: (result: MentorOutput) => void;
    setError: (error: string) => void;
    reset: () => void;
}

const initialState = {
    code: "",
    language: "typescript",
    explanationSteps: [],
    diagramSyntax: "",
    expectedOutput: "",
    status: "idle" as const,
    error: null,
    provider: null,
};

export const createMentorStore = () =>
    createStore<MentorState>((set) => ({
        ...initialState,

        setCode: (code) => set({ code }),
        setLanguage: (language) => set({ language }),
        setProvider: (provider) => set({ provider }),

        startAnalysis: () =>
            set({
                status: "analyzing",
                error: null,
                explanationSteps: [],
                diagramSyntax: "",
                expectedOutput: "",
            }),

        setResult: (result) =>
            set({
                status: "done",
                code: result.code,
                explanationSteps: result.explanationSteps,
                diagramSyntax: result.diagramSyntax,
                expectedOutput: result.expectedOutput,
                error: null,
            }),  

        setError: (error) => set({ status: "error", error }),

        reset: () => set(initialState),
    }));

export type MentorStore = ReturnType<typeof createMentorStore>;
