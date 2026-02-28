/**
 * Workspace Layout — Dual Sidebar Architecture
 * Chat mode  → renders original Chat Sidebar (history + settings)
 * Autonomous → renders AppSidebar (PlotAI enterprise nav)
 */
"use client";

import { useUIStore } from "@/store/uiStore";
import Sidebar from "@/components/workspace/Sidebar";
import AppSidebar from "@/components/layout/AppSidebar";
import SettingsModal from "@/components/workspace/SettingsModal";

export default function WorkspaceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const activeWorkspace = useUIStore((s) => s.activeWorkspace);

    return (
        <div className="flex h-screen overflow-hidden bg-white dark:bg-[#171717]">
            {/* Conditional Sidebar */}
            {activeWorkspace === "autonomous" ? (
                <AppSidebar />
            ) : (
                <Sidebar />
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {children}
            </main>

            {/* Modals */}
            <SettingsModal />
        </div>
    );
}
