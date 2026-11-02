import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const backendSecret = process.env.BACKEND_INTERNAL_SECRET;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthenticated" },
      { status: 401 },
    );
  }

  if (!backendUrl || !backendSecret) {
    return NextResponse.json(
      { error: "Backend environment variables are missing" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `${backendUrl}/api/users/${session.user.id}`,
      {
        headers: {
          "backend-internal-secret": backendSecret,
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            res.status === 404
              ? "Account not found"
              : "Unable to load account",
        },
        { status: res.status },
      );
    }

    const account = await res.json();

    return NextResponse.json(account, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the account service" },
      { status: 502 },
    );
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthenticated" },
      { status: 401 },
    );
  }

  if (!backendUrl || !backendSecret) {
    return NextResponse.json(
      { error: "Backend environment variables are missing" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `${backendUrl}/api/users/${session.user.id}`,
      {
        method: "DELETE",
        headers: {
          "backend-internal-secret": backendSecret,
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Unable to delete your account" },
        { status: res.status },
      );
    }

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the account service" },
      { status: 502 },
    );
  }
}