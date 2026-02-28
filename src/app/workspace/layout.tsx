/**
 * Workspace Layout — Enterprise CrewAI sidebar + main canvas.
 * AppSidebar replaces the old chat Sidebar.
 */
"use client";

import AppSidebar from "@/components/layout/AppSidebar";
import SettingsModal from "@/components/workspace/SettingsModal";

export default function WorkspaceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-white dark:bg-[#171717]">
            {/* Enterprise Sidebar */}
            <AppSidebar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {children}
            </main>

            {/* Modals */}
            <SettingsModal />
        </div>
    );
}
