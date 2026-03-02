/**
 * MentorWorkspace — Split-Pane Container (Light Theme)
 *
 * Two-column layout using react-resizable-panels:
 * Left: Monaco CodeViewer | Right: ExplanationPanel
 * Top bar: language selector, provider selector, Analyze button
 */
"use client";

import { useCallback, useState } from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
import { useMentorStore } from "./MentorStoreProvider";
import { useUIStore } from "@/store/uiStore";
import { useAssistantStore } from "@/store/assistantStore";
import { checkOllamaStatus } from "@/lib/ollamaPing";
import CodeViewer from "./CodeViewer";
import ExplanationPanel from "./ExplanationPanel";

const LANGUAGES = [
    { value: "typescript", label: "TypeScript" },
    { value: "javascript", label: "JavaScript" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "csharp", label: "C#" },
    { value: "go", label: "Go" },
    { value: "rust", label: "Rust" },
    { value: "cpp", label: "C++" },
    { value: "html", label: "HTML" },
    { value: "css", label: "CSS" },
    { value: "sql", label: "SQL" },
    { value: "json", label: "JSON" },
];

const PROVIDERS = [
    { value: "gemini", label: "Gemini" },
    { value: "openai", label: "OpenAI" },
    { value: "claude", label: "Claude" },
    { value: "grok", label: "Grok" },
    { value: "ollama", label: "Ollama" },
];

export default function MentorWorkspace({ onClose }: { onClose: () => void }) {
    const code = useMentorStore((s) => s.code);
    const language = useMentorStore((s) => s.language);
    const provider = useMentorStore((s) => s.provider);
    const status = useMentorStore((s) => s.status);
    const setLanguage = useMentorStore((s) => s.setLanguage);
    const setProvider = useMentorStore((s) => s.setProvider);
    const startAnalysis = useMentorStore((s) => s.startAnalysis);
    const setResult = useMentorStore((s) => s.setResult);
    const setError = useMentorStore((s) => s.setError);
    const openAssistantChat = useAssistantStore((s) => s.openAssistantChat);
    const openAssistantModal = useAssistantStore((s) => s.openAssistantModal);
    const [isCheckingAssistant, setIsCheckingAssistant] = useState(false);

    const apiKeys = useUIStore((s) => s.apiKeys);

    const selectedProvider = provider || "gemini";

    const handleAnalyze = useCallback(async () => {
        if (!code.trim()) return;

        const apiKey = apiKeys[selectedProvider];
        if (!apiKey && selectedProvider !== "ollama") {
            setError(`No API key configured for ${selectedProvider}. Add it in Settings.`);
            return;
        }

        startAnalysis();

        try {
            const response = await fetch("/api/chat/mentor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: code.trim(),
                    language,
                    apiKey: apiKey || undefined,
                    provider: selectedProvider,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || "Analysis failed.");
            }

            setResult({
                code: data.code || code,
                explanationSteps: Array.isArray(data.explanationSteps)
                    ? data.explanationSteps
                    : [],
                diagramSyntax: data.diagramSyntax || "",
                expectedOutput: data.expectedOutput || "",
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Analysis failed.";
            setError(message);
        }
    }, [code, language, selectedProvider, apiKeys, startAnalysis, setResult, setError]);

    const handleOpenAssistant = useCallback(async () => {
        if (isCheckingAssistant) return;

        setIsCheckingAssistant(true);
        const isOnline = await checkOllamaStatus();
        if (isOnline) {
            openAssistantChat();
        } else {
            openAssistantModal();
        }
        setIsCheckingAssistant(false);
    }, [isCheckingAssistant, openAssistantChat, openAssistantModal]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#171717] transition-colors">
            {/* ── Top Bar ────────────────────────────────────── */}
            <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] transition-colors">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-700 dark:text-gray-300">
                            <polyline points="4 17 10 11 4 5" />
                            <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                        <h1 className="text-base font-semibold text-slate-800 dark:text-gray-100">Code Mentor</h1>
                    </div>

                    <div className="h-5 w-px bg-gray-200 dark:bg-[#262626]" />

                    {/* Language selector */}
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="bg-white dark:bg-[#171717] text-slate-700 dark:text-gray-300 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-[#262626] outline-none hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
                    >
                        {LANGUAGES.map((lang) => (
                            <option key={lang.value} value={lang.value}>
                                {lang.label}
                            </option>
                        ))}
                    </select>

                    {/* Provider selector */}
                    <select
                        value={selectedProvider}
                        onChange={(e) => setProvider(e.target.value)}
                        className="bg-white dark:bg-[#171717] text-slate-700 dark:text-gray-300 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-[#262626] outline-none hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
                    >
                        {PROVIDERS.map((p) => (
                            <option key={p.value} value={p.value}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            void handleOpenAssistant();
                        }}
                        disabled={isCheckingAssistant}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-[#262626] text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors disabled:opacity-70"
                        title="Open Assistant"
                    >
                        {isCheckingAssistant && (
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
                        )}
                        Assistant
                    </button>

                    <button
                        onClick={handleAnalyze}
                        disabled={!code.trim() || status === "analyzing"}
                        className={`
                            px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200
                            ${status === "analyzing"
                                ? "bg-gray-200 text-gray-500 dark:bg-[#262626] dark:text-gray-400 cursor-wait"
                                : "bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-white active:scale-[0.98]"
                            }
                            disabled:opacity-40 disabled:cursor-not-allowed
                        `}
                    >
                        {status === "analyzing" ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="12" />
                                </svg>
                                Analyzing...
                            </span>
                        ) : (
                            "Analyze"
                        )}
                    </button>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#262626] transition-colors"
                        title="Close Code Mentor"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* ── Split Pane ─────────────────────────────────── */}
            <div className="flex-1 overflow-hidden p-3">
                <Group
                    orientation="horizontal"
                    id="mentor-layout"
                    className="h-full rounded-xl overflow-hidden"
                >
                    {/* Left: Code Editor */}
                    <Panel defaultSize={50} minSize={25}>
                        <CodeViewer />
                    </Panel>

                    {/* Resize Handle */}
                    <Separator className="mentor-resize-handle" />

                    {/* Right: Explanation */}
                    <Panel defaultSize={50} minSize={25}>
                        <div className="h-full rounded-lg border border-gray-200 bg-white overflow-hidden">
                            <ExplanationPanel />
                        </div>
                    </Panel>
                </Group>
            </div>
        </div>
    );
}
