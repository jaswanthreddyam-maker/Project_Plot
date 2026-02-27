"use client";

import { useAssistantStore } from "@/store/assistantStore";

export default function AssistantToggle() {
    const isAssistantActive = useAssistantStore((s) => s.isAssistantActive);
    const setAssistantActive = useAssistantStore((s) => s.setAssistantActive);

    return (
        <button
            suppressHydrationWarning
            onClick={() => setAssistantActive(!isAssistantActive)}
            className={`
                px-3 py-1.5 rounded-full text-xs font-medium
                border transition-all duration-200
                ${isAssistantActive
                    ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:bg-[#171717] dark:border-[#262626] dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-200"
                }
            `}
            title={isAssistantActive ? "Close Assistant" : "Open Assistant"}
        >
            Assistant
        </button>
    );
}
