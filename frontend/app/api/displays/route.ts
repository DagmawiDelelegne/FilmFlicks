import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const backendUrl = process.env.BACKEND_URL;
const backendSecret = process.env.BACKEND_INTERNAL_SECRET;

export async function POST(request: Request) {
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

  const body: unknown = await request.json().catch(() => null);

  if (
    !body ||
    typeof body !== "object" ||
    !("media_id" in body) ||
    !("event_id" in body) ||
    typeof body.media_id !== "number" ||
    !Number.isSafeInteger(body.media_id) ||
    body.media_id <= 0 ||
    typeof body.event_id !== "string"
  ) {
    return NextResponse.json(
      { error: "Expected a media ID and an event ID" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `${backendUrl}/api/displays/${session.user.id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "backend-internal-secret": backendSecret,
        },
        body: JSON.stringify({
          media_id: body.media_id,
          event_id: body.event_id,
        }),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to record display" },
        { status: res.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 502 },
    );
  }
}
