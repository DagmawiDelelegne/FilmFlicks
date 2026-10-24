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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!backendUrl || !backendSecret) {
    return missingBackendEnvResponse();
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? "10";
  const backendParams = new URLSearchParams({limit});

  for (const id of searchParams.getAll("exclude_ids")){
    backendParams.append("exclude_ids",id);
  }

  const res = await fetch(
    `${backendUrl}/api/rec/${session.user.id}?${backendParams.toString()}`,
    {
      headers: {
        "backend-internal-secret": backendSecret,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
