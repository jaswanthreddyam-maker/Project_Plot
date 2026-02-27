/**
 * Returns which auth providers are configured.
 * Used by the login page to conditionally show OAuth buttons.
 */
import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    });
}
