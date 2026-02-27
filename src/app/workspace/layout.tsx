/**
 * Workspace Layout — Bypass auth for development.
 * Renders sidebar + main area directly.
 */
"use client";

import Sidebar from "@/components/workspace/Sidebar";
import SettingsModal from "@/components/workspace/SettingsModal";

export default function WorkspaceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-white">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {children}
            </main>

            {/* Modals */}
            <SettingsModal />
        </div>
    );
}
