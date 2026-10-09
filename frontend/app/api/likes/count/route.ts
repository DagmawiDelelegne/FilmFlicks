import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(){
    const session =  await getServerSession(authOptions);

    if(!session?.user?.id){
        return NextResponse.json({error: "Unauthenticated"}, {status: 401});
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const backendSecret = process.env.BACKEND_INTERNAL_SECRET;

    if (!backendUrl || !backendSecret){
        return NextResponse.json({error: "Backend enviroment variables are missing"}, {status: 500});
    }

    const res = await fetch(`${backendUrl}/api/likes/${session.user.id}/count`, {
            headers: {
                "backend-internal-secret": backendSecret,
            },
            cache: "no-store",
        }
    )

    if (!res.ok){
        return NextResponse.json(
            {error: "Failed to get user liked count"},
            {status: res.status}
        )
    }
    const likedCount = await res.json();
    return NextResponse.json(likedCount);
}