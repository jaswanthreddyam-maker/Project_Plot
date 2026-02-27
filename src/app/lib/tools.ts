import { z } from "zod/v4";
import type { Tool } from "ai";
import { CommandType } from "./schema";
import { retrieveDocuments } from "@/app/actions/retrieval";

// ── Vector Search Tool ───────────────────────────────────────
export const vectorSearchTool: Tool<
    { query: string; topK: number },
    { results: { content: string; metadata: { source: string; similarity: number } }[]; totalResults: number }
> = {
    description:
        "Search the Plot knowledge base for documents relevant to the user's question. " +
        "Use this tool when the user asks about application features, documentation, or data.",
    inputSchema: z.object({
        query: z.string().describe("The semantic search query to find relevant documents"),
        topK: z
            .number()
            .int()
            .min(1)
            .max(10)
            .default(5)
            .describe("Number of top results to return"),
    }),
    execute: async ({ query, topK }) => {
        console.log(`[vectorSearch] Query: "${query}", topK: ${topK}`);

        const docs = await retrieveDocuments(query, topK);

        return {
            results: docs.map((doc) => ({
                content: doc.content,
                metadata: {
                    source: doc.metadata.source,
                    similarity: doc.metadata.similarity,
                },
            })),
            totalResults: docs.length,
        };
    },
};

// ── Dispatch UI Command Tool ─────────────────────────────────
export const dispatchUICommandTool: Tool<
    { commandType: string; targetElementId: string; payload?: Record<string, unknown> },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { success: boolean; command: any }
> = {
    description:
        "Dispatch a UI automation command to the Plot application. " +
        "Use this to programmatically click buttons, paste text into inputs, " +
        "copy content, or navigate to different pages on behalf of the user.",
    inputSchema: z.object({
        commandType: CommandType.describe(
            "The type of UI action to perform: CLICK, PASTE, COPY, NAVIGATE, SELECT, SCROLL_TO"
        ),
        targetElementId: z
            .string()
            .min(1)
            .describe("The unique DOM element ID to target for this command"),
        payload: z
            .record(z.string(), z.unknown())
            .optional()
            .describe(
                "Additional data for the command. For PASTE: { value: string }. " +
                "For NAVIGATE: { url: string }. For COPY: { sourceField: string }."
            ),
    }),
    execute: async ({ commandType, targetElementId, payload }) => {
        const command = {
            id: crypto.randomUUID(),
            commandType,
            targetElementId,
            payload: payload || {},
            timestamp: Date.now(),
        };
        console.log(`[dispatchUICommand] Generated command:`, command);
        return { success: true, command };
    },
};

// ── Get Application State Tool ───────────────────────────────
export const getApplicationStateTool: Tool<
    { includeDOM: boolean },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { route: string; activeProviders: string[]; activeResponseSetId: null; domSnapshot?: any }
> = {
    description:
        "Get the current state of the Plot application, including the active route, " +
        "enabled providers, and visible UI elements.",
    inputSchema: z.object({
        includeDOM: z
            .boolean()
            .default(false)
            .describe("Whether to include the sanitized DOM snapshot in the response"),
    }),
    execute: async ({ includeDOM }) => {
        return {
            route: "/workspace",
            activeProviders: ["openai", "gemini", "claude"],
            activeResponseSetId: null,
            domSnapshot: includeDOM ? { tag: "body", children: [] } : undefined,
        };
    },
};

// ── Tool Registry ────────────────────────────────────────────
export const assistantTools = {
    vectorSearch: vectorSearchTool,
    dispatchUICommand: dispatchUICommandTool,
    getApplicationState: getApplicationStateTool,
};
