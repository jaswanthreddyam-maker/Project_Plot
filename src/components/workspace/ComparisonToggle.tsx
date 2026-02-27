/**
 * ComparisonToggle — Toggle for Referee Mode
 * Shows in the workspace header, enables/disables auto-referee summary
 */
"use client";

import { useUIStore } from "@/store/uiStore";

export default function ComparisonToggle() {
    const comparisonMode = useUIStore((s) => s.comparisonMode);
    const setComparisonMode = useUIStore((s) => s.setComparisonMode);

    return (
        <button
            suppressHydrationWarning
            onClick={() => setComparisonMode(!comparisonMode)}
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                border transition-all duration-200
                ${comparisonMode
                    ? "bg-violet-50 border-violet-300 text-violet-700"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }
            `}
            title={comparisonMode ? "Disable Referee Mode" : "Enable Referee Mode"}
        >
            {/* Sparkle icon */}
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={comparisonMode ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                className={comparisonMode ? "text-violet-500" : "text-gray-400"}
            >
                <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74L12 2z" />
            </svg>
            <span>Referee</span>
            {/* Toggle dot */}
            <div
                className={`
                    w-8 h-4 rounded-full relative transition-colors duration-200
                    ${comparisonMode ? "bg-violet-500" : "bg-gray-300"}
                `}
            >
                <div
                    className={`
                        absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200
                        ${comparisonMode ? "translate-x-4" : "translate-x-0.5"}
                    `}
                />
            </div>
        </button>
    );
}
