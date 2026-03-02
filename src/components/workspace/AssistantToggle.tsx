"use client";

import { useState } from "react";
import { checkOllamaStatus } from "@/lib/ollamaPing";
import { useAssistantStore } from "@/store/assistantStore";

export default function AssistantToggle() {
    const isAssistantActive = useAssistantStore((s) => s.isAssistantActive);
    const openAssistantChat = useAssistantStore((s) => s.openAssistantChat);
    const openAssistantModal = useAssistantStore((s) => s.openAssistantModal);
    const closeAssistant = useAssistantStore((s) => s.closeAssistant);
    const [isChecking, setIsChecking] = useState(false);

    const handleClick = async () => {
        if (isChecking) return;

        if (isAssistantActive) {
            closeAssistant();
            return;
        }

        setIsChecking(true);
        const isOnline = await checkOllamaStatus();
        if (isOnline) {
            openAssistantChat();
        } else {
            openAssistantModal();
        }
        setIsChecking(false);
    };

    return (
        <button
            suppressHydrationWarning
            onClick={() => {
                void handleClick();
            }}
            disabled={isChecking}
            className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                border transition-all duration-200 disabled:opacity-80
                ${isAssistantActive
                    ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:bg-[#171717] dark:border-[#262626] dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-200"
                }
            `}
            title={isAssistantActive ? "Close Assistant" : "Open Assistant"}
        >
            {isChecking && (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
            )}
            Assistant
        </button>
    );
}
