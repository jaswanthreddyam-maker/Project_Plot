"use client";

import { motion, AnimatePresence } from "framer-motion";
import { UserCheck, ShieldAlert, Check, X } from "lucide-react";

interface ApprovalOverlayProps {
    isOpen: boolean;
    executionId: string;
    toolName: string;
    arguments: unknown;
    onApprove: () => void;
    onDeny: () => void;
}

export const ApprovalOverlay = ({
    isOpen,
    toolName,
    arguments: args,
    onApprove,
    onDeny
}: ApprovalOverlayProps) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/20 dark:bg-black/40 backdrop-blur-xl"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="w-full max-w-lg bg-white dark:bg-black border-2 border-black dark:border-white rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.1)] overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-black dark:bg-white px-8 py-6 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-white dark:text-black">
                            <UserCheck size={24} />
                            <h2 className="text-xl font-bold tracking-tight uppercase">Manual Intervention Required</h2>
                        </div>
                        <ShieldAlert size={24} className="text-white dark:text-black opacity-50" />
                    </div>

                    <div className="p-8">
                        {/* Tool Info */}
                        <div className="mb-6">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Sensitive Tool Detected</p>
                            <h3 className="text-2xl font-black text-black dark:text-white uppercase tracking-tighter">{toolName}</h3>
                        </div>

                        {/* Arguments Display */}
                        <div className="mb-8">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Proposed Arguments</p>
                            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 font-mono text-xs overflow-x-auto">
                                <pre className="text-black dark:text-slate-300">
                                    {JSON.stringify(args, null, 2)}
                                </pre>
                            </div>
                        </div>

                        {/* Reasoning / Alert */}
                        <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl mb-8 text-amber-900 dark:text-amber-200">
                            <ShieldAlert size={20} className="shrink-0 mt-0.5" />
                            <p className="text-sm">
                                This action is flagged as sensitive. Please review the parameters carefully before approving the agent to proceed.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={onDeny}
                                className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border-2 border-black dark:border-white text-black dark:text-white font-bold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all outline-none ring-0 active:scale-95"
                            >
                                <X size={20} /> Deny Action
                            </button>
                            <button
                                onClick={onApprove}
                                className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-bold hover:opacity-90 transition-all outline-none ring-0 active:scale-95 shadow-lg shadow-black/10 dark:shadow-white/5"
                            >
                                <Check size={20} /> Approve
                            </button>
                        </div>
                    </div>

                    {/* Footer Progress */}
                    <div className="px-8 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-900 flex justify-center">
                        <div className="flex items-center gap-1.5 opacity-20">
                            <div className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white animate-bounce" />
                            <div className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white animate-bounce [animation-delay:0.2s]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white animate-bounce [animation-delay:0.4s]" />
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
