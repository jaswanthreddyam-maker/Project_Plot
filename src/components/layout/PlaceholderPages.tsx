"use client";

/* ═══════════════════════════════════════════════════════════════
 * Placeholder Pages — Styled empty-state components for routes
 * not yet fully implemented in the CrewAI Enterprise UI.
 * ═══════════════════════════════════════════════════════════════ */

interface PlaceholderProps {
    title: string;
    description: string;
    icon: React.ReactNode;
}

function PlaceholderPage({ title, description, icon }: PlaceholderProps) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white dark:bg-[#171717]">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
                    {icon}
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{title}</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{description}</p>
                <div className="mt-8 px-6 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                        🚧 This feature is under active development and will be available soon.
                    </p>
                </div>
            </div>
        </div>
    );
}

export function AutomationsPage() {
    return (
        <PlaceholderPage
            title="Automations Live"
            description="Manage and monitor your active crew automations from this dashboard. Launch your AI crews and access them via API from anywhere."
            icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500 dark:text-slate-400">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
            }
        />
    );
}

export function TracesPage() {
    return (
        <PlaceholderPage
            title="Traces"
            description="View execution traces, logs, and performance metrics for all your crew runs. Debug and optimize your AI workflows."
            icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500 dark:text-slate-400">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
            }
        />
    );
}

export function EnvironmentVariablesPage() {
    return (
        <PlaceholderPage
            title="Environment Variables"
            description="Securely manage environment variables and secrets used by your crews and agents during execution."
            icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500 dark:text-slate-400">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
            }
        />
    );
}

export function UsagePage() {
    return (
        <PlaceholderPage
            title="Usage"
            description="Track API usage, token consumption, and resource utilization across all your crews and agents."
            icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500 dark:text-slate-400">
                    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
            }
        />
    );
}

export function BillingPage() {
    return (
        <PlaceholderPage
            title="Billing"
            description="Manage your subscription, view invoices, and update payment methods for your CrewAI account."
            icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500 dark:text-slate-400">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                </svg>
            }
        />
    );
}

export function SettingsPage() {
    return (
        <PlaceholderPage
            title="Settings"
            description="Configure your workspace preferences, team settings, and global application configuration."
            icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500 dark:text-slate-400">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            }
        />
    );
}

export function ToolsIntegrationsPage() {
    return (
        <PlaceholderPage
            title="Tools & Integrations"
            description="Manage apps, internal tools, and MCP servers for your CrewAI agents. Connect to third-party services."
            icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500 dark:text-slate-400">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
            }
        />
    );
}
