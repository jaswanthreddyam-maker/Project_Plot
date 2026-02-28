/**
 * Centralized API configuration.
 * Uses NEXT_PUBLIC_API_URL env var when deployed, falls back to 127.0.0.1 for local dev.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/**
 * Fetch wrapper that adds an explicit timeout to requests.
 * Default timeout is 10000ms (10 seconds).
 */
export async function fetchWithTimeout(resource: RequestInfo | URL, options: RequestInit & { timeout?: number } = {}) {
    const { timeout = 10000 } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout}ms`);
        }
        throw error;
    }
}
