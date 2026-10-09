import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const backendSecret = process.env.BACKEND_INTERNAL_SECRET;

function missingBackendEnvResponse() {
  return NextResponse.json(
    { error: "Backend environment variables are missing" },
    { status: 500 }
  );
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if(!session?.user?.id){
        return NextResponse.json({error: "Unauthenticated"}, {status: 401});
    }

    if (!backendUrl || !backendSecret) {
        return missingBackendEnvResponse();
    }

    const {media_id, action} = await request.json();

    const res = await fetch(`${backendUrl}/api/feedback`,{
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "backend-internal-secret": backendSecret,
        },
        body: JSON.stringify(
            { 
                user_id: session.user.id,
                media_id,
                feedback: action
            }
        ),
    });

    if (!res.ok){
        return NextResponse.json(
            {error: "Failed to send feedback"},
            {status: res.status}
        );
    }
    const data = await res.json();
    return NextResponse.json(data);
    
}
