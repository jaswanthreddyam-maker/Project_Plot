/**
 * ════════════════════════════════════════════════════════════════
 * useAssistantCommand Hook — Per-Component Command Listener
 * ════════════════════════════════════════════════════════════════
 *
 * Consumed by interactive elements (buttons, inputs) within Plot.
 * Monitors the Zustand command queue for commands targeting this
 * specific component by element ID.
 *
 * Architecture:
 *   - Component retains full sovereignty over HOW to execute
 *   - AI assistant merely SUGGESTS that state should change
 *   - Uses shallow comparison to prevent unnecessary re-renders
 */

"use client";

import { useCallback, useMemo } from "react";
import { useAssistantStore } from "@/store/assistantStore";
import type { AutomationCommand } from "@/app/lib/schema";

interface UseAssistantCommandReturn {
    /** The pending command targeting this element, or null */
    pendingCommand: AutomationCommand | null;
    /** Call this after successfully executing the command */
    acknowledgeCommand: () => void;
}

/**
 * Hook for components to react to AI-generated UI commands.
 *
 * @param elementId - The unique DOM element ID this component manages
 * @returns The pending command and an acknowledgment function
 *
 * @example
 * ```tsx
 * function MyInput({ id }: { id: string }) {
 *   const { pendingCommand, acknowledgeCommand } = useAssistantCommand(id);
 *
 *   useEffect(() => {
 *     if (pendingCommand?.commandType === "PASTE") {
 *       setValue(pendingCommand.payload?.value as string);
 *       acknowledgeCommand();
 *     }
 *   }, [pendingCommand]);
 * }
 * ```
 */
export function useAssistantCommand(
    elementId: string
): UseAssistantCommandReturn {
    const commandQueue = useAssistantStore((s) => s.commandQueue);
    const dequeueCommand = useAssistantStore((s) => s.dequeueCommand);
    const setProcessing = useAssistantStore((s) => s.setProcessing);

    // Find the first command targeting this element
    const pendingCommand = useMemo(() => {
        return (
            commandQueue.find(
                (cmd) => cmd.targetElementId === elementId
            ) || null
        );
    }, [commandQueue, elementId]);

    // Acknowledge and dequeue the command
    const acknowledgeCommand = useCallback(() => {
        if (!pendingCommand) return;

        // Dequeue the command from the store
        dequeueCommand();

        // Check if queue is now empty
        const remaining = useAssistantStore.getState().commandQueue.length;
        if (remaining === 0) {
            setProcessing(false);
        }
    }, [pendingCommand, dequeueCommand, setProcessing]);

    return { pendingCommand, acknowledgeCommand };
}
