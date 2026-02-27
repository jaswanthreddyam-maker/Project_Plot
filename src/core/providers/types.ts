/**
 * ════════════════════════════════════════════════════════════════
 * LLM Adapter Interface (Strategy Pattern Contract)
 * ════════════════════════════════════════════════════════════════
 *
 * Every LLM provider adapter MUST implement this interface.
 * The ProviderManager uses it to fire isolated streaming requests.
 */

export type ProviderName = "openai" | "gemini" | "claude" | "ollama" | "grok" | "verdict";

export interface StreamMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface LLMAdapter {
    /**
     * Returns a ReadableStream of UTF-8 text chunks.
     * Each chunk is a fragment of the model's response.
     *
     * @param messages  - Conversation history
     * @param options   - Optional per-request overrides
     * @returns         - A ReadableStream<string> for token-by-token delivery
     */
    stream(
        messages: StreamMessage[],
        options?: StreamOptions
    ): Promise<ReadableStream<string>>;
}

export interface StreamOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

/**
 * Standardized stream error that adapters inject into the stream
 * instead of leaking raw vendor errors to the client.
 */
export class StreamError extends Error {
    constructor(
        public provider: ProviderName,
        public userMessage: string,
        public originalError?: unknown
    ) {
        super(userMessage);
        this.name = "StreamError";
    }
}
