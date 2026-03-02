"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAssistantStore } from "@/store/assistantStore";
import { PlotAssistantModal } from "@/components/ai/PlotAssistantModal";
import { PlotChat } from "@/components/ai/PlotChat";

export function AssistantOverlay() {
    const isAssistantActive = useAssistantStore((s) => s.isAssistantActive);
    const assistantSurface = useAssistantStore((s) => s.assistantSurface);
    const closeAssistant = useAssistantStore((s) => s.closeAssistant);

    return (
        <AnimatePresence mode="wait">
            {isAssistantActive && assistantSurface && (
                <motion.div
                    key={assistantSurface}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {assistantSurface === "chat" ? (
                        <PlotChat onClose={closeAssistant} />
                    ) : (
                        <PlotAssistantModal onClose={closeAssistant} />
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
