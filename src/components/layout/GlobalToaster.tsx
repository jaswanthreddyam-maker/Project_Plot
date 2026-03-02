"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Info, X } from "lucide-react";
import { subscribeToToasts, ToastEvent } from "@/lib/toast";

function toastLabel(type: ToastEvent["type"]): string {
    if (type === "success") return "Success";
    if (type === "error") return "Error";
    return "Info";
}

function ToastIcon({ type }: { type: ToastEvent["type"] }) {
    if (type === "success") return <Check size={14} />;
    return <Info size={14} />;
}

export default function GlobalToaster() {
    const [toasts, setToasts] = useState<ToastEvent[]>([]);
    const timeoutMapRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    const dismissToast = useCallback((id: number) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
        const timeoutId = timeoutMapRef.current.get(id);
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutMapRef.current.delete(id);
        }
    }, []);

    useEffect(() => {
        const timeoutMap = timeoutMapRef.current;

        const unsubscribe = subscribeToToasts((event) => {
            setToasts((current) => [event, ...current].slice(0, 5));

            const timeoutId = setTimeout(() => {
                dismissToast(event.id);
            }, event.duration);
            timeoutMap.set(event.id, timeoutId);
        });

        return () => {
            unsubscribe();
            timeoutMap.forEach((timeoutId) => clearTimeout(timeoutId));
            timeoutMap.clear();
        };
    }, [dismissToast]);

    if (toasts.length === 0) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="pointer-events-auto rounded-xl border border-gray-200 bg-white/95 p-3 text-black shadow-xl backdrop-blur dark:border-[#333639] dark:bg-[#131314]/95 dark:text-[#e3e3e3]"
                >
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-gray-700 dark:border-[#333639] dark:text-[#c4c7c5]">
                            <ToastIcon type={toast.type} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-[#c4c7c5]">
                                {toastLabel(toast.type)}
                            </p>
                            <p className="mt-0.5 text-sm leading-snug">{toast.message}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => dismissToast(toast.id)}
                            className="rounded-md border border-gray-200 bg-white p-1 text-gray-500 hover:text-black dark:border-[#333639] dark:bg-[#1e1f22] dark:text-[#c4c7c5] dark:hover:text-white"
                            aria-label="Dismiss notification"
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
