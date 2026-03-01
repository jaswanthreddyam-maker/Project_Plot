/**
 * Workspace Page
 *
 * Routes content based on activeAmpRoute from Zustand.
 * Renders provider toggles, stacked response sets, referee summaries,
 * and image fan-out grids for the crew-studio route.
 */
"use client";

import { useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useUIStore, ProviderOption } from "@/store/uiStore";
import { useChatStore, ProviderImageState, ResponseSet } from "@/store/chatStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import StreamColumn from "@/components/workspace/StreamColumn";
import PromptInput from "@/components/workspace/PromptInput";
import ProfileDropdown from "@/components/workspace/ProfileDropdown";
import ComparisonToggle from "@/components/workspace/ComparisonToggle";
import AssistantToggle from "@/components/workspace/AssistantToggle";
import MentorOverlay from "@/components/mentor/MentorOverlay";
import OtherToolsToggle from "@/components/tools/OtherToolsToggle";
import OtherToolsMenu from "@/components/tools/OtherToolsMenu";
import ToolExecutionStream from "@/components/tools/ToolExecutionStream";
import CrewStudio from "@/components/autonomous/CrewStudio";
import LLMConnections from "@/components/autonomous/LLMConnections";
import ToolsIntegrations from "@/components/autonomous/ToolsIntegrations";
import Traces from "@/components/autonomous/Traces";
import Automations from "@/components/autonomous/Automations";
import EnvVariables from "@/components/autonomous/EnvVariables";
import Settings from "@/components/autonomous/Settings";
import Templates from "@/components/autonomous/Templates";
import AgentsRepository from "@/components/autonomous/AgentsRepository";
import { UsagePage } from "@/components/autonomous/Usage";
import { BillingPage } from "@/components/autonomous/Billing";
import {
    AutomationsPage as AutomationsPlaceholder,
    SettingsPage,
    ToolsIntegrationsPage
} from "@/components/layout/PlaceholderPages";

const ALL_PROVIDERS: { id: ProviderOption; label: string }[] = [
    { id: "openai", label: "Openai" },
    { id: "gemini", label: "Gemini" },
    { id: "claude", label: "Claude" },
    { id: "grok", label: "Grok" },
    { id: "ollama", label: "Ollama" },
];

const PROVIDER_LABELS: Record<string, string> = {
    openai: "OpenAI",
    gemini: "Gemini",
    claude: "Claude",
    grok: "Grok",
    ollama: "Ollama",
};

function gridClassesForCount(count: number): string {
    switch (count) {
        case 1:
            return "grid-cols-1 max-w-xl";
        case 2:
            return "grid-cols-1 md:grid-cols-2";
        case 3:
            return "grid-cols-1 md:grid-cols-3";
        case 4:
            return "grid-cols-1 md:grid-cols-2 xl:grid-cols-4";
        case 5:
        default:
            return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
    }
}

function RefereeSummaryBox({ responseSet }: { responseSet: ResponseSet }) {
    const referee = responseSet.referee;

    return (
        <div className="mt-4 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-violet-900">Referee Summary</span>
                {referee.provider && (
                    <span className="text-xs text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                        {referee.provider}
                    </span>
                )}
            </div>

            {referee.status === "idle" && (
                <p className="text-sm text-violet-700">
                    Referee mode is on. Summary will appear after this response set completes.
                </p>
            )}

            {referee.status === "waiting" && (
                <p className="text-sm text-violet-700">Waiting for provider responses...</p>
            )}

            {referee.status === "streaming" && (
                <p className="text-sm text-violet-700">Referee is analyzing responses...</p>
            )}

            {referee.status === "error" && (
                <p className="text-sm text-red-600">
                    {referee.error || "Referee summary failed."}
                </p>
            )}

            {referee.status === "done" && (
                <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                    {referee.summary}
                </div>
            )}
        </div>
    );
}

function ImageProviderCard({
    provider,
    state,
}: {
    provider: string;
    state?: ProviderImageState;
}) {
    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">
                    {PROVIDER_LABELS[provider] || provider}
                </h3>
                <span className="text-xs text-gray-500 capitalize">
                    {state?.status || "idle"}
                </span>
            </div>

            <div className="p-3 min-h-[120px]">
                {state?.error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-2">
                        {state.error}
                    </div>
                )}

                {state?.images?.length ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {state.images.map((image) => (
                            <div key={image.id} className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={image.dataUrl}
                                    alt={`${provider} generated image`}
                                    className="w-full aspect-square object-cover"
                                />
                            </div>
                        ))}
                    </div>
                ) : state?.status === "streaming" ? (
                    <p className="text-sm text-gray-500">Generating images...</p>
                ) : (
                    <p className="text-sm text-gray-400">No images yet.</p>
                )}
            </div>
        </div>
    );
}

export default function WorkspacePage() {
    const isMobile = useIsMobile();
    const activeAmpRoute = useUIStore((s) => s.activeAmpRoute);
    const activeProviders = useUIStore((s) => s.activeProviders);
    const setActiveProviders = useUIStore((s) => s.setActiveProviders);
    const toggleProvider = useUIStore((s) => s.toggleProvider);
    const comparisonMode = useUIStore((s) => s.comparisonMode);
    const responseSets = useChatStore((s) => s.responseSets);
    const { data: session } = useSession();

    const AVAILABLE_PROVIDERS = useMemo(() => {
        if (isMobile) return ALL_PROVIDERS.filter((p) => p.id !== "ollama");
        return ALL_PROVIDERS;
    }, [isMobile]);

    useEffect(() => {
        if (isMobile) {
            if (activeProviders.includes("ollama")) {
                const newProviders = activeProviders.filter((p) => p !== "ollama");
                if (!newProviders.includes("gemini")) newProviders.push("gemini");
                setActiveProviders(newProviders);
            } else if (activeProviders.length === 0) {
                setActiveProviders(["gemini"]);
            }
        }
    }, [isMobile, activeProviders, setActiveProviders]);

    const disabledProviders = useMemo(
        () => AVAILABLE_PROVIDERS.filter((provider) => !activeProviders.includes(provider.id)),
        [activeProviders, AVAILABLE_PROVIDERS]
    );

    const idleGridClasses = useMemo(
        () => gridClassesForCount(activeProviders.length),
        [activeProviders.length]
    );

    /* ═══ Route-based content rendering ═══ */
    const renderRouteContent = () => {
        switch (activeAmpRoute) {
            case "agents-repository":
                return <AgentsRepository />;
            case "templates":

                return <Templates />;
            case "llm-connections":
            case "environment-variables":
            case "settings":
                return <Settings />;
            case "automations":
                return <Automations />;
            case "tools-integrations":
                return <ToolsIntegrations />;
            case "traces":
                return <Traces />;
            case "usage":
                return <UsagePage />;
            case "billing":
                return <BillingPage />;
            case "crew-studio":
            default:
                return renderCrewStudio();
        }
    };

    const renderCrewStudio = () => (
        <>
            <div className="px-6 pb-2">
                <div className="flex flex-wrap gap-2">
                    {AVAILABLE_PROVIDERS.map((provider) => {
                        const isActive = activeProviders.includes(provider.id);
                        return (
                            <button
                                key={provider.id}
                                suppressHydrationWarning
                                onClick={() => toggleProvider(provider.id)}
                                className={`
                                    px-4 py-1.5 text-sm rounded-full border transition-all duration-200
                                    ${isActive
                                        ? "bg-gray-800 text-white border-gray-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200"
                                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400 dark:bg-[#171717] dark:text-gray-400 dark:border-slate-700 dark:hover:border-slate-500"
                                    }
                                `}
                            >
                                {provider.label}
                            </button>
                        );
                    })}
                </div>

                {disabledProviders.length > 0 && (
                    <p className="text-sm text-orange-500 mt-2">
                        Disabled providers: {disabledProviders.map((provider) => provider.id).join(", ")}
                    </p>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
                {activeProviders.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <p className="text-gray-400 dark:text-gray-500">
                            No providers selected. Click a provider button above to activate it.
                        </p>
                    </div>
                ) : responseSets.length === 0 ? (
                    <div className={`grid ${idleGridClasses} gap-4`}>
                        {activeProviders.map((provider) => (
                            <StreamColumn key={provider} provider={provider} emptyMessage="Start a conversation." />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {responseSets.map((responseSet) => {
                            const visibleProviders = responseSet.providers.filter((provider) =>
                                activeProviders.includes(provider as ProviderOption)
                            );
                            const setGridClasses = gridClassesForCount(visibleProviders.length);

                            return (
                                <section key={responseSet.id} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-[#171717] transition-colors">
                                    <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50 max-w-3xl">
                                        <p className="text-sm text-gray-700 dark:text-gray-300">{responseSet.prompt}</p>
                                    </div>

                                    {visibleProviders.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                                            <p className="text-sm text-gray-500">
                                                All providers for this response set are currently disabled.
                                                Re-enable a provider above to show its column.
                                            </p>
                                        </div>
                                    ) : responseSet.mode === "text" ? (
                                        <div className={`grid ${setGridClasses} gap-4`}>
                                            {visibleProviders.map((provider) => {
                                                const response = responseSet.responses[provider];
                                                return (
                                                    <StreamColumn
                                                        key={`${responseSet.id}-${provider}`}
                                                        provider={provider}
                                                        textOverride={response?.currentText || ""}
                                                        isStreamingOverride={response?.isStreaming || false}
                                                        errorOverride={response?.error || null}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className={`grid ${setGridClasses} gap-4`}>
                                            {visibleProviders.map((provider) => (
                                                <ImageProviderCard
                                                    key={`${responseSet.id}-${provider}`}
                                                    provider={provider}
                                                    state={responseSet.images[provider]}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {comparisonMode && responseSet.mode === "text" && (
                                        <RefereeSummaryBox responseSet={responseSet} />
                                    )}
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>

            <PromptInput />
        </>
    );

    /* ═══ Workspace mode & header logic ═══ */
    const activeWorkspace = useUIStore((s) => s.activeWorkspace);
    const setActiveWorkspace = useUIStore((s) => s.setActiveWorkspace);
    const setActiveAmpRoute = useUIStore((s) => s.setActiveAmpRoute);
    const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
    const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);

    /* ── CHAT MODE ── */
    if (activeWorkspace === "chat") {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-[#171717] transition-colors duration-200" suppressHydrationWarning>
                {/* Chat Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#262626]">
                    <div className="flex items-center gap-3">
                        {sidebarCollapsed && (
                            <button
                                onClick={() => setSidebarCollapsed(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors mr-2"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 dark:text-gray-400">
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <line x1="3" y1="12" x2="21" y2="12" />
                                    <line x1="3" y1="18" x2="21" y2="18" />
                                </svg>
                            </button>
                        )}
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Workspace</h1>
                    </div>

                    <div className="flex items-center gap-3">

                        <AssistantToggle />
                        <div className="relative flex items-center gap-3">
                            <OtherToolsToggle />
                            <OtherToolsMenu />
                        </div>
                        <ComparisonToggle />
                        {session?.user ? (
                            <ProfileDropdown />
                        ) : (
                            <a href="/login" className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                Login
                            </a>
                        )}
                    </div>
                </header>

                {/* Provider Toggle Pills */}
                <div className="px-6 pb-2 pt-4">
                    <div className="flex flex-wrap gap-2">
                        {AVAILABLE_PROVIDERS.map((provider) => {
                            const isActive = activeProviders.includes(provider.id);
                            return (
                                <button
                                    key={provider.id}
                                    suppressHydrationWarning
                                    onClick={() => toggleProvider(provider.id)}
                                    className={`
                                        px-4 py-1.5 text-sm rounded-full border transition-all duration-200
                                        ${isActive
                                            ? "bg-gray-800 text-white border-gray-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200"
                                            : "bg-white text-gray-600 border-gray-300 hover:border-gray-400 dark:bg-[#171717] dark:text-gray-400 dark:border-slate-700 dark:hover:border-slate-500"
                                        }
                                    `}
                                >
                                    {provider.label}
                                </button>
                            );
                        })}
                    </div>

                    {disabledProviders.length > 0 && (
                        <p className="text-sm text-orange-500 mt-2">
                            Disabled providers: {disabledProviders.map((provider) => provider.id).join(", ")}
                        </p>
                    )}
                </div>

                {/* Chat Content Area — StreamColumns & Response Sets */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {activeProviders.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-gray-400 dark:text-gray-500">
                                No providers selected. Click a provider button above to activate it.
                            </p>
                        </div>
                    ) : responseSets.length === 0 ? (
                        <div className={`grid ${idleGridClasses} gap-4`}>
                            {activeProviders.map((provider) => (
                                <StreamColumn key={provider} provider={provider} emptyMessage="Start a conversation." />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {responseSets.map((responseSet) => {
                                const visibleProviders = responseSet.providers.filter((provider) =>
                                    activeProviders.includes(provider as ProviderOption)
                                );
                                const setGridClasses = gridClassesForCount(visibleProviders.length);

                                return (
                                    <section key={responseSet.id} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-[#171717] transition-colors">
                                        <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50 max-w-3xl">
                                            <p className="text-sm text-gray-700 dark:text-gray-300">{responseSet.prompt}</p>
                                        </div>

                                        {visibleProviders.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                                                <p className="text-sm text-gray-500">
                                                    All providers for this response set are currently disabled.
                                                    Re-enable a provider above to show its column.
                                                </p>
                                            </div>
                                        ) : responseSet.mode === "text" ? (
                                            <div className={`grid ${setGridClasses} gap-4`}>
                                                {visibleProviders.map((provider) => {
                                                    const response = responseSet.responses[provider];
                                                    return (
                                                        <StreamColumn
                                                            key={`${responseSet.id}-${provider}`}
                                                            provider={provider}
                                                            textOverride={response?.currentText || ""}
                                                            isStreamingOverride={response?.isStreaming || false}
                                                            errorOverride={response?.error || null}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className={`grid ${setGridClasses} gap-4`}>
                                                {visibleProviders.map((provider) => (
                                                    <ImageProviderCard
                                                        key={`${responseSet.id}-${provider}`}
                                                        provider={provider}
                                                        state={responseSet.images[provider]}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {comparisonMode && responseSet.mode === "text" && (
                                            <RefereeSummaryBox responseSet={responseSet} />
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </div>

                <PromptInput />
                <MentorOverlay />
                <ToolExecutionStream />
            </div>
        );
    }

    /* ── AUTONOMOUS MODE ── */
    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#171717] transition-colors duration-200 autonomous-theme" suppressHydrationWarning>
            {/* Autonomous Header — Back button */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#262626]">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setActiveWorkspace("chat")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back to Chat
                    </button>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">PlotAI Workspace</h1>
                </div>
                <div className="flex items-center gap-3">
                    <AssistantToggle />
                    <div className="relative flex items-center gap-3">
                        <OtherToolsToggle />
                        <OtherToolsMenu />
                    </div>
                </div>
            </header>

            {/* Route-based content */}
            {renderRouteContent()}
        </div>
    );
}
