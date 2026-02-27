/**
 * ════════════════════════════════════════════════════════════════
 * Telemetry Route Handler — /api/telemetry
 * ════════════════════════════════════════════════════════════════
 *
 * Dedicated HTTP POST endpoint for batched client-side
 * OpenTelemetry trace ingestion. Validates incoming spans,
 * enriches with server-side context, and logs them.
 *
 * In production, forward to an observability platform:
 *   - SigNoz, Datadog, New Relic, or a custom Clickhouse setup
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TelemetrySpanSchema } from "@/app/lib/schema";

const BatchPayloadSchema = z.object({
    spans: z.array(TelemetrySpanSchema).min(1).max(100),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parseResult = BatchPayloadSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: "Invalid telemetry payload", details: parseResult.error.message },
                { status: 400 }
            );
        }

        const { spans } = parseResult.data;

        // ── Enrich spans with server context ─────────────
        const enrichedSpans = spans.map((span) => ({
            ...span,
            serverTimestamp: Date.now(),
            environment: process.env.NODE_ENV || "development",
        }));

        // ── Log to console (dev) ─────────────────────────
        // In production, forward to observability platform
        console.log(
            `[telemetry] Received ${enrichedSpans.length} spans:`,
            enrichedSpans.map((s) => `${s.spanName} (${s.sessionId.slice(0, 8)}...)`)
        );

        return NextResponse.json(
            { received: enrichedSpans.length },
            { status: 200 }
        );
    } catch (error) {
        console.error("[telemetry] Error processing spans:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
