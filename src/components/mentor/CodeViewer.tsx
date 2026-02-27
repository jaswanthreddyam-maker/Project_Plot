/**
 * CodeViewer — Monaco Editor (Left Column)
 *
 * Dynamically imported with ssr: false to avoid web worker
 * and CSS issues during server rendering. Binds to mentorStore.
 */
"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useMentorStore } from "./MentorStoreProvider";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full bg-[#1e1e1e] dark:bg-white border border-gray-200 dark:border-none rounded-lg">
            <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                <span className="text-sm">Loading editor...</span>
            </div>
        </div>
    ),
});

export default function CodeViewer() {
    const code = useMentorStore((s) => s.code);
    const language = useMentorStore((s) => s.language);
    const setCode = useMentorStore((s) => s.setCode);
    const { resolvedTheme } = useTheme();

    const isGlobalLight = resolvedTheme === "light" || resolvedTheme === undefined;
    const editorTheme = isGlobalLight ? "vs-dark" : "light";
    const containerClasses = isGlobalLight 
        ? "bg-[#1e1e1e] text-gray-100 border-gray-800"
        : "bg-white text-gray-900 border-none";

    return (
        <div className={`h-full w-full overflow-hidden rounded-lg border transition-colors ${containerClasses}`}>
            <MonacoEditor
                height="100%"
                language={language}
                value={code}
                onChange={(value) => setCode(value || "")}
                theme={editorTheme}
                options={{
                    automaticLayout: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                    lineHeight: 22,
                    padding: { top: 16, bottom: 16 },
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    renderLineHighlight: "line",
                    bracketPairColorization: { enabled: true },
                    cursorBlinking: "smooth",
                    cursorSmoothCaretAnimation: "on",
                    smoothScrolling: true,
                }}
            />
        </div>
    );
}
