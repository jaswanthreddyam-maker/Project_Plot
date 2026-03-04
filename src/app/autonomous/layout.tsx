"use client";

import AppSidebar from "@/components/layout/AppSidebar";
import BackendOfflineBanner from "@/components/layout/BackendOfflineBanner";
import SettingsModal from "@/components/workspace/SettingsModal";
import { BackendTokenGate } from "@/components/auth/BackendTokenSync";

export default function AutonomousLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-white dark:bg-[#171717]">
            <AppSidebar />

            <main className="flex-1 flex flex-col overflow-hidden">
                <BackendOfflineBanner />
                <BackendTokenGate>{children}</BackendTokenGate>
            </main>

            <SettingsModal />
        </div>
    );
}
