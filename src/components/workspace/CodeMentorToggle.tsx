/**
 * CodeMentorToggle — Toggle for Code Mentor Mode
 * Shows in the workspace header, enables/disables the senior developer
 * debugging prompt injection for all provider streams.
 */
"use client";

import { useUIStore } from "@/store/uiStore";

export default function CodeMentorToggle() {
    const codeMentorMode = useUIStore((s) => s.codeMentorMode);
    const toggleCodeMentorMode = useUIStore((s) => s.toggleCodeMentorMode);

    return (
        <button
            suppressHydrationWarning
            onClick={toggleCodeMentorMode}
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                border transition-all duration-200
                ${codeMentorMode
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }
            `}
            title={codeMentorMode ? "Disable Code Mentor" : "Enable Code Mentor"}
        >
            {/* Terminal icon */}
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={codeMentorMode ? "text-emerald-500" : "text-gray-400"}
            >
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <span>Code Mentor</span>
            {/* Toggle dot */}
            <div
                className={`
                    w-8 h-4 rounded-full relative transition-colors duration-200
                    ${codeMentorMode ? "bg-emerald-500" : "bg-gray-300"}
                `}
            >
                <div
                    className={`
                        absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200
                        ${codeMentorMode ? "translate-x-4" : "translate-x-0.5"}
                    `}
                />
            </div>
        </button>
    );
}
