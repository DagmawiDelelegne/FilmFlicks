import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthenticated" },
      { status: 401 },
    );
  }

  const backendUrl = process.env.BACKEND_URL;

  if (!backendUrl) {
    return NextResponse.json(
      { error: "Backend URL is missing" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);

  const params = new URLSearchParams({
    query: searchParams.get("query") ?? "",
    page: searchParams.get("page") ?? "1",
    limit: searchParams.get("limit") ?? "10",
  });

  try {
    const res = await fetch(`${backendUrl}/api/search?${params}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Unable to search media" },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the search service" },
      { status: 502 },
    );
  }
}