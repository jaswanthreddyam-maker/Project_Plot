"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import ProfileDropdown from "@/components/workspace/ProfileDropdown";
import CodeMentorToggle from "@/components/workspace/CodeMentorToggle";

interface WorkspaceHeaderProps {
    sidebarCollapsed?: boolean;
    onExpandSidebar?: () => void;
    actions?: React.ReactNode;
}

export default function WorkspaceHeader({
    sidebarCollapsed = false,
    onExpandSidebar,
    actions,
}: WorkspaceHeaderProps) {
    const { status } = useSession();

    return (
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#262626]">
            <div className="flex items-center gap-3">
                {sidebarCollapsed && onExpandSidebar && (
                    <button
                        onClick={onExpandSidebar}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors mr-2"
                        aria-label="Expand sidebar"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 dark:text-gray-400">
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                )}

                <nav className="flex items-center gap-2 text-xl font-bold">
                    <Link href="/workspace" className="text-gray-900 dark:text-white hover:underline underline-offset-4">
                        Workspace
                    </Link>
                    <span className="text-gray-400 dark:text-gray-500">/</span>
                    <Link href="/autonomous" className="text-gray-900 dark:text-white hover:underline underline-offset-4">
                        Plot Autonomous
                    </Link>
                </nav>
            </div>

            <div className="flex items-center gap-3">
                {actions}
                <CodeMentorToggle />
                {status === "authenticated" ? (
                    <ProfileDropdown />
                ) : status === "loading" ? (
                    <div className="h-8 w-8 rounded-full border border-gray-200 dark:border-slate-700 animate-pulse" aria-hidden="true" />
                ) : (
                    <Link href="/login" className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        Login
                    </Link>
                )}
            </div>
        </header>
    );
}
