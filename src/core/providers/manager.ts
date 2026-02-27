/**
 * ════════════════════════════════════════════════════════════════
 * ProviderManager — Strategy Pattern Orchestrator
 * ════════════════════════════════════════════════════════════════
 *
 * Dynamically instantiates the correct LLM adapter based on the
 * provider name. Each adapter is isolated — strictly one adapter
 * per streaming request. No Promise.all for stream generation.
 *
 * The manager handles:
 *   1. Adapter instantiation from decrypted API keys
 *   2. Key-to-adapter mapping
 *   3. Validation that the requested provider is configured
 */

import { LLMAdapter, ProviderName, StreamMessage, StreamOptions } from "./types";
import { OpenAIAdapter } from "./openai-adapter";
import { GeminiAdapter } from "./gemini-adapter";
import { ClaudeAdapter } from "./claude-adapter";
import { OllamaAdapter } from "./ollama-adapter";
import { GrokAdapter } from "./grok-adapter";

export class ProviderManager {
    private adapters: Map<ProviderName, LLMAdapter> = new Map();

    /**
     * Registers a provider adapter with its decrypted API key.
     * For Ollama, no API key is needed — pass undefined.
     */
    registerProvider(provider: ProviderName, apiKey?: string): void {
        switch (provider) {
            case "openai":
                if (!apiKey) throw new Error("OpenAI requires an API key");
                this.adapters.set("openai", new OpenAIAdapter(apiKey));
                break;
            case "gemini":
                if (!apiKey) throw new Error("Gemini requires an API key");
                this.adapters.set("gemini", new GeminiAdapter(apiKey));
                break;
            case "claude":
                if (!apiKey) throw new Error("Claude requires an API key");
                this.adapters.set("claude", new ClaudeAdapter(apiKey));
                break;
            case "ollama":
                // Ollama runs locally — no API key needed
                this.adapters.set("ollama", new OllamaAdapter(apiKey));
                break;
            case "grok":
                if (!apiKey) throw new Error("Grok requires an API key");
                this.adapters.set("grok", new GrokAdapter(apiKey));
                break;
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }

    /**
     * Returns the adapter for a specific provider.
     * Throws if the provider hasn't been registered.
     */
    getAdapter(provider: ProviderName): LLMAdapter {
        const adapter = this.adapters.get(provider);
        if (!adapter) {
            throw new Error(
                `Provider "${provider}" is not configured. Add your API key in Settings.`
            );
        }
        return adapter;
    }

    /**
     * Streams a response from a SINGLE provider.
     * This is called once per provider per request — NOT multiplexed.
     *
     * Architecture: One provider = one worker = one stream.
     */
    async streamFromProvider(
        provider: ProviderName,
        messages: StreamMessage[],
        options?: StreamOptions
    ): Promise<ReadableStream<string>> {
        const adapter = this.getAdapter(provider);
        return adapter.stream(messages, options);
    }

    /** Returns a list of all registered provider names. */
    getRegisteredProviders(): ProviderName[] {
        return Array.from(this.adapters.keys());
    }

    /** Checks if a specific provider is registered. */
    hasProvider(provider: ProviderName): boolean {
        return this.adapters.has(provider);
    }
}
