import {getServerSession} from "next-auth";
import {NextResponse} from "next/server";
import {authOptions} from "@/app/api/auth/[...nextauth]/route";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const backendSecret = process.env.BACKEND_INTERNAL_SECRET;

function missingBackendEnvResponse() {
  return NextResponse.json(
    { error: "Backend environment variables are missing" },
    { status: 500 }
  );
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {media_id} = await request.json()

   

    if (!backendUrl || !backendSecret) {
        return missingBackendEnvResponse();
    }

    const res = await fetch(`${backendUrl}/api/likes`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "backend-internal-secret": backendSecret,
        },
        body: JSON.stringify({
            user_id: session.user.id,
            media_id,
        }),
    });

    if(!res.ok){
        return NextResponse.json({error: "Failed to like media"},
            {status: res.status}
        );
    }

    return NextResponse.json({ok: true});
}


export async function GET(request: Request){
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {searchParams} = new URL(request.url);
    const page = searchParams.get("page") ?? "1";
    const limit = searchParams.get("limit") ?? "10";

    if (!backendUrl || !backendSecret) {
        return missingBackendEnvResponse();
    }

    const res = await fetch(`${backendUrl}/api/likes/${session.user.id}?page=${page}&limit=${limit}`,
        {
            headers: {
                "backend-internal-secret": backendSecret,
            },
            cache: "no-store",
        }
    );

    if (!res.ok){
        return NextResponse.json(
            {error: "Failed to fetch liked media"},
            {status: res.status}
        );
    }
    const data = await res.json();
    return NextResponse.json(data);
}