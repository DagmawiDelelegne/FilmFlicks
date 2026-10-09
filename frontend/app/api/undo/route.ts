import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const backendSecret = process.env.BACKEND_INTERNAL_SECRET;

function missingBackendEnvResponse() {
  return NextResponse.json(
    { error: "Backend environment variables are missing" },
    { status: 500 }
  );
}

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!backendUrl || !backendSecret) {
    return missingBackendEnvResponse();
  }

  const res = await fetch(`${backendUrl}/api/undo/${session.user.id}`, {
    method: "POST",
    headers: {
      "backend-internal-secret": backendSecret,
    },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to undo feedback" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
