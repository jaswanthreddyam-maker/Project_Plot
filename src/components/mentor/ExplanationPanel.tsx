/**
 * ExplanationPanel — Right Column (Light Theme)
 *
 * Renders structured explanation steps (heading + description),
 * a Mermaid diagram, and expected output in a terminal-like block.
 */
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useMentorStore } from "./MentorStoreProvider";

function MermaidDiagram({ syntax }: { syntax: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [rendered, setRendered] = useState(false);

    const renderDiagram = useCallback(async () => {
        if (!syntax.trim() || !containerRef.current) return;

        try {
            const mermaid = (await import("mermaid")).default;
            mermaid.initialize({
                startOnLoad: false,
                securityLevel: "loose",
                theme: "default",
                themeVariables: {
                    primaryColor: "#e0e7ff",
                    primaryTextColor: "#1e293b",
                    primaryBorderColor: "#94a3b8",
                    lineColor: "#94a3b8",
                    secondaryColor: "#f1f5f9",
                    tertiaryColor: "#f8fafc",
                    fontFamily: "Inter, system-ui, sans-serif",
                },
            });

            const id = `mermaid-${Date.now()}`;
            const { svg } = await mermaid.render(id, syntax);
            if (containerRef.current) {
                containerRef.current.innerHTML = svg;
                setRendered(true);
                setError(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Invalid diagram syntax");
            setRendered(false);
        }
    }, [syntax]);

    useEffect(() => {
        setRendered(false);
        setError(null);
        renderDiagram();
    }, [renderDiagram]);

    if (!syntax.trim()) return null;

    return (
        <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-500 dark:text-gray-400" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors">
                    Logic Flow
                </span>
            </div>

            {error ? (
                <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 p-4 transition-colors">
                    <p className="text-sm text-red-600 dark:text-red-400">
                        Could not render diagram. The syntax may be invalid.
                    </p>
                    <pre className="mt-2 text-xs text-red-400 dark:text-red-300/80 overflow-x-auto whitespace-pre-wrap">
                        {syntax}
                    </pre>
                </div>
            ) : !rendered ? (
                <div className="rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#262626]/50 p-6 flex items-center justify-center transition-colors">
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="12" />
                        </svg>
                        Rendering diagram...
                    </div>
                </div>
            ) : null}

            <div
                ref={containerRef}
                className="mentor-diagram rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#ececec] p-4 overflow-x-auto transition-colors"
                style={{ display: rendered ? "block" : error ? "none" : "none" }}
            />
        </div>
    );
}

function ExpectedOutputBlock({ output }: { output: string }) {
    if (!output.trim()) return null;

    return (
        <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-500 dark:text-gray-400" strokeWidth="2">
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors">
                    Expected Output
                </span>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#262626]/50 p-4 overflow-x-auto transition-colors">
                <pre className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap transition-colors"
                    style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}>
                    {output}
                </pre>
            </div>
        </div>
    );
}

export default function ExplanationPanel() {
    const steps = useMentorStore((s) => s.explanationSteps);
    const diagramSyntax = useMentorStore((s) => s.diagramSyntax);
    const expectedOutput = useMentorStore((s) => s.expectedOutput);
    const status = useMentorStore((s) => s.status);
    const error = useMentorStore((s) => s.error);

    return (
        <div className="h-full overflow-y-auto p-6 scrollbar-thin bg-white dark:bg-[#171717] transition-colors">
            {status === "idle" && steps.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#262626] flex items-center justify-center mb-4 transition-colors">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400 dark:text-gray-500" strokeWidth="1.5">
                            <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
                        </svg>
                    </div>
                    <p className="text-gray-400 dark:text-gray-500 text-sm leading-relaxed max-w-xs transition-colors">
                        Paste your code in the editor, select a provider, and click Analyze to get a structured explanation with logic diagrams.
                    </p>
                </div>
            )}

            {status === "analyzing" && (
                <div className="flex flex-col items-center justify-center h-full">
                    <div className="relative w-12 h-12 mb-4">
                        <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-[#262626]" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gray-700 dark:border-t-gray-300 animate-spin" />
                    </div>
                    <p className="text-slate-700 dark:text-gray-200 text-sm font-medium transition-colors">Analyzing code...</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 transition-colors">Building explanation and flow diagram</p>
                </div>
            )}

            {status === "error" && (
                <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 p-4 mt-4 transition-colors">
                    <p className="text-sm text-red-600 dark:text-red-400">{error || "Analysis failed."}</p>
                </div>
            )}

            {steps.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-6">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-500 dark:text-gray-400" strokeWidth="2">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors">
                            Explanation
                        </span>
                    </div>

                    <div className="space-y-5">
                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className="mentor-paragraph"
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <h3 className="text-lg font-bold text-slate-900 dark:text-gray-100 mb-1.5 transition-colors">
                                    {step.heading}
                                </h3>
                                <p className="text-[15px] text-slate-600 dark:text-gray-300 leading-[1.8] transition-colors">
                                    {step.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    <MermaidDiagram syntax={diagramSyntax} />
                    <ExpectedOutputBlock output={expectedOutput} />
                </div>
            )}
        </div>
    );
}
