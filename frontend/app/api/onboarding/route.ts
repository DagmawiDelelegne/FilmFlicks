import { authOptions } from "../auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function POST(request: Request){
    const session = await getServerSession(authOptions);

    if (!session?.user?.id){
        return NextResponse.json({error: "Unauthenticated"}, {status: 401});
    }

    const genres: unknown = await request.json();

    if (!Array.isArray(genres) || !genres.every((genre) => typeof genre === "string")){
        return NextResponse.json({error: "Expected an array of genre strings"},
            {status: 400},
        );
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const backendSecret = process.env.BACKEND_INTERNAL_SECRET;

    if (!backendUrl || !backendSecret) {
    return NextResponse.json(
        { error: "Backend environment variables are missing" },
        { status: 500 },
    );
    }

    const res = await fetch(`${backendUrl}/api/onboarding/${session?.user?.id}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/Json",
                "backend-internal-secret": backendSecret, 
            },
            body: JSON.stringify(genres),
            cache: "no-store",
        },
    );

    if (!res.ok) {
        return NextResponse.json(
            {error: "Failed to save genre preference"},
            {status: res.status}
        )
    }

    return NextResponse.json({ok: true});
}


export async function GET(){
    const session = await getServerSession(authOptions);

    if(!session?.user?.id){
        return NextResponse.json({error: "Unauthenticated"}, {status: 401});
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const backendSecret = process.env.BACKEND_INTERNAL_SECRET;

    if (!backendUrl || !backendSecret) {
    return NextResponse.json(
        { error: "Backend environment variables are missing" },
        { status: 500 },
    );
    }
    
    const res = await fetch(`${backendUrl}/api/onboarding/${session?.user?.id}`,{
        headers: {
            "backend-internal-secret": backendSecret
        },
        cache: "no-store",
    });

    if(!res.ok){
        return NextResponse.json({error: "unable to get user preference"}, {status: res.status});
    }

    const data = await res.json();
    return NextResponse.json(data);

}
