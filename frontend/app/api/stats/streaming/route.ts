import {getServerSession} from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const backendSecret = process.env.BACKEND_INTERNAL_SECRET;

function missingBackendEnvResponse() {
  return NextResponse.json(
    { error: "Backend environment variables are missing" },
    { status: 500 }
  );
}

export async function GET(request : Request){

    const session = await getServerSession(authOptions);

    if (!session?.user?.id){
        return NextResponse.json({error: "Unauthenticated"}, {status: 401});
    }

    if (!backendSecret || !backendUrl){
        return missingBackendEnvResponse();
    }

    const res = await fetch(`${backendUrl}/api/stats/streaming/${session?.user?.id}`,
        {
            headers: {
                "backend-internal-secret" : backendSecret
            },
            cache: "no-store",
        }
    );

    if (!res.ok){
        return NextResponse.json({error: "Unable to fetch user streaming stats"}, {status: res.status});
    }
    const data = await res.json();
    return NextResponse.json(data);
}