import {getServerSession} from "next-auth";
import {NextResponse} from "next/server";
import {authOptions} from "@/app/api/auth/[...nextauth]/route";


export async function GET(){
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const backendSecret = process.env.BACKEND_INTERNAL_SECRET;

    if (!backendUrl || !backendSecret) {
        return NextResponse.json(
            {error: "Backend enviroment variables are missing"},
            {status: 500}
        );
    }

    const res = await fetch(`${backendUrl}/api/likes/${session.user.id}/ids`, {
        headers: {
            "backend-internal-secret": backendSecret,
        },
        cache: "no-store",
    })

    if (!res.ok) {
        return NextResponse.json(
            {error: "Failed to fetch liked ids"},
            {status: res.status}
        );
    }
    const likedIds = await res.json();
    return NextResponse.json(likedIds);
}