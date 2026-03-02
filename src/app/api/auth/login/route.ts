import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
        const fastapiUrl = process.env.API_URL || "http://127.0.0.1:8000";

        const formData = new URLSearchParams();
        formData.append("username", normalizedEmail);
        formData.append("password", password); // FastAPI ignores this, but requires it for OAuth2

        const apiRes = await fetch(`${fastapiUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData,
        });

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
