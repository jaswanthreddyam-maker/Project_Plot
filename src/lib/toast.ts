export type ToastType = "success" | "error" | "info";

export interface ToastEvent {
    id: number;
    type: ToastType;
    message: string;
    duration: number;
}

type ToastListener = (event: ToastEvent) => void;

const listeners = new Set<ToastListener>();
let toastId = 1;

export function showToast(
    message: string,
    type: ToastType = "info",
    duration = 3500
): number {
    const event: ToastEvent = {
        id: toastId++,
        type,
        message,
        duration,
    };
    listeners.forEach((listener) => listener(event));
    return event.id;
}

export function subscribeToToasts(listener: ToastListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
