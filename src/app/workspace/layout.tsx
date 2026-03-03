/**
 * Workspace Layout — Dual Sidebar Architecture
 * Chat mode  → renders original Chat Sidebar (history + settings)
 * Autonomous → renders AppSidebar (PlotAI enterprise nav)
 */
"use client";

import { useUIStore } from "@/store/uiStore";
import { usePathname } from "next/navigation";
import { isWorkspaceSubRoute } from "@/lib/workspaceRoutes";
import Sidebar from "@/components/workspace/Sidebar";
import AppSidebar from "@/components/layout/AppSidebar";
import BackendOfflineBanner from "@/components/layout/BackendOfflineBanner";
import SettingsModal from "@/components/workspace/SettingsModal";

export default function WorkspaceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const hideSidebarForPlotStudio =
        pathname === "/workspace/plot-studio" ||
        pathname.startsWith("/workspace/plot-studio/");
    const activeWorkspace = useUIStore((s) => s.activeWorkspace);
    const effectiveWorkspace =
        isWorkspaceSubRoute(pathname) ? "autonomous" : activeWorkspace;

    return (
        <div className="flex h-screen overflow-hidden bg-white dark:bg-[#171717]">
            {/* Conditional Sidebar */}
            {!hideSidebarForPlotStudio &&
                (effectiveWorkspace === "autonomous" ? (
                    <AppSidebar />
                ) : (
                    <Sidebar />
                ))}

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <BackendOfflineBanner />
                {children}
            </main>

            {/* Modals */}
            <SettingsModal />
        </div>
    );
}
