/**
 * MentorOverlay — Full-Screen Overlay
 *
 * Wraps the MentorWorkspace in a fixed overlay with slide-in
 * animation. Renders when codeMentorMode is active. Resets
 * the mentorStore on mount for fresh state.
 */
"use client";

import { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";
import { MentorStoreProvider, useMentorStore } from "./MentorStoreProvider";
import MentorWorkspace from "./MentorWorkspace";

function MentorContent() {
    const reset = useMentorStore((s) => s.reset);
    const toggleCodeMentorMode = useUIStore((s) => s.toggleCodeMentorMode);

    // Reset store on mount for fresh state
    useEffect(() => {
        reset();
    }, [reset]);

    return <MentorWorkspace onClose={toggleCodeMentorMode} />;
}

export default function MentorOverlay() {
    const codeMentorMode = useUIStore((s) => s.codeMentorMode);

    if (!codeMentorMode) return null;

    return (
        <div className="mentor-overlay fixed inset-0 z-40 bg-white">
            <MentorStoreProvider>
                <MentorContent />
            </MentorStoreProvider>
        </div>
    );
}
