import {getServerSession} from "next-auth";
import {NextResponse} from "next/server";
import {authOptions} from "@/app/api/auth/[...nextauth]/route";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {media_id} = await request.json()

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const backendSecret = process.env.BACKEND_INTERNAL_SECRET;

    if (!backendUrl || !backendSecret) {
    return NextResponse.json(
      { error: "Backend environment variables are missing" },
      { status: 500 }
    );
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