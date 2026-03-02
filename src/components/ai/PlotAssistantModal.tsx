"use client";

interface PlotAssistantModalProps {
    onClose: () => void;
}

export function PlotAssistantModal({ onClose }: PlotAssistantModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-700 bg-[#0a0d12] text-zinc-100 shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
                    <h2 className="text-lg font-semibold">Plot Assistant Setup</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        aria-label="Close setup modal"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4 px-6 py-6">
                    <p className="text-sm text-zinc-300">
                        Local Ollama is offline. Install and start it to open Plot Assistant chat.
                    </p>

                    <div className="rounded-xl border border-zinc-700 bg-[#0f141d] p-4">
                        <p className="text-sm font-semibold text-zinc-100">
                            Step 1: Download Ollama
                        </p>
                        <a
                            href="https://ollama.com/download"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-100 underline underline-offset-4"
                        >
                            Open ollama.com/download
                        </a>
                    </div>

                    <div className="rounded-xl border border-zinc-700 bg-[#0f141d] p-4">
                        <p className="text-sm font-semibold text-zinc-100">
                            Step 2: Run model locally
                        </p>
                        <code className="mt-2 block rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-100">
                            ollama run llama3
                        </code>
                    </div>
                </div>

                <div className="border-t border-zinc-800 bg-black/40 px-6 py-4">
                    <div className="flex items-center gap-3 text-sm text-zinc-400">
                        <span className="relative inline-flex h-3 w-3">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-zinc-300 opacity-40 animate-ping" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-zinc-100 animate-pulse" />
                        </span>
                        <span>Waiting for local Ollama instance...</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
