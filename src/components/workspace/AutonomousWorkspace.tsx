import { useUIStore } from "@/store/uiStore";
import { motion } from "framer-motion";

export default function AutonomousWorkspace() {
    return (
        <div className="flex flex-col items-center justify-center flex-1 w-full p-8 text-center bg-slate-50/50 dark:bg-[#171717]">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-col items-center justify-center max-w-xl"
            >
                <div className="w-24 h-24 mb-6 rounded-[2rem] bg-gradient-to-tr from-indigo-500 to-violet-500 shadow-2xl shadow-indigo-500/20 flex items-center justify-center border border-white/20 dark:border-white/10">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                </div>

                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-violet-500 mb-4 tracking-tight">
                    Agent Workspace
                </h2>

                <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed mb-8">
                    Your dedicated environment for Plot Autonomous workflows. Trigger long-running tasks from the tools menu and monitor them securely here.
                </p>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => useUIStore.getState().setActiveWorkspace("chat")}
                        className="px-6 py-2.5 rounded-full text-sm font-medium border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
                    >
                        Return to Multi-Chat
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
