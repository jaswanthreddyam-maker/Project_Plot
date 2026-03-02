import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

function resolveFastApiBase(): string {
    const configured = process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
    if (configured) {
        return configured.replace(/\/+$/, "");
    }

    throw new Error("Missing API_URL (or NEXT_PUBLIC_API_URL) for FastAPI backend");
}

export async function POST(req: Request) {
    try {
        const body = await req.text();
        const params = new URLSearchParams(body);
        const email = params.get("username");
        const password = params.get("password");

        if (!email || !password) {
            return NextResponse.json(
                { detail: "Email and password are required" },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        // 1. Verify user credentials against Prisma Database
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (!user || !user.passwordHash) {
            return NextResponse.json(
                { detail: "Invalid credentials" },
                { status: 401 }
            );
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            return NextResponse.json(
                { detail: "Invalid credentials" },
                { status: 401 }
            );
        }

        // 2. Fetch JWT token from FastAPI backend to maintain existing API authorization
        let fastapiUrl: string;
        try {
            fastapiUrl = resolveFastApiBase();
        } catch (error) {
            console.error("[Auth Login Config Error]", error);
            return NextResponse.json(
                { detail: "Backend auth service URL is not configured" },
                { status: 500 }
            );
        }

        const formData = new URLSearchParams();
        formData.append("username", normalizedEmail);
        formData.append("password", password); // FastAPI ignores this, but requires it for OAuth2

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        let apiRes: Response;
        try {
            apiRes = await fetch(`${fastapiUrl}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: formData,
                signal: controller.signal,
                cache: "no-store",
            });
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                return NextResponse.json(
                    { detail: "Backend login request timed out" },
                    { status: 504 }
                );
            }
            console.error("FastAPI Login Request Error:", error);
            return NextResponse.json(
                { detail: "Failed to reach backend login service" },
                { status: 502 }
            );
        } finally {
            clearTimeout(timeoutId);
        }

        if (!apiRes.ok) {
            console.error("FastAPI Login Failed:", await apiRes.text());
            return NextResponse.json(
                { detail: "Internal Server Error fetching token" },
                { status: 500 }
            );
        }

        const data = await apiRes.json();

        return NextResponse.json(data, { status: 200 });

    } catch (error) {
        console.error("[Auth Login Error]", error);
        return NextResponse.json(
            { detail: "Internal Server Error" },
            { status: 500 }
        );
    }
}
