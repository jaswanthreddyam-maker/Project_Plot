/**
 * Returns which auth providers are configured.
 * Used by the login page to conditionally show OAuth buttons.
 */
import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    });
}
