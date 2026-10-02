import { getServerSession } from "next-auth";
import {authOptions} from "@/app/api/auth/[...nextauth]/route";
import {NextResponse} from "next/server";
import { error } from "console";

export async function DELETE(
    _request: Request,
    {params} : {params : Promise<{mediaId: string}>}
){
    const session = await getServerSession(authOptions);

    if (!session?.user?.id){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {mediaId} = await params;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const backendSecret = process.env.BACKEND_INTERNAL_SECRET;

    if(!backendSecret || !backendUrl){
        return NextResponse.json(
            { error: "Backend environment variables are missing" },
            { status: 500 });
    }
    const res = await fetch(
    `${backendUrl}/api/likes/${session.user.id}/${mediaId}`,
    {
      method: "DELETE",
      headers: {
        "backend-internal-secret": backendSecret,
      },
    }
    );

    if (!res.ok) {
        return NextResponse.json(
            { error: "Failed to unlike media" },
            { status: res.status }
        );
    }

    return NextResponse.json({ ok: true });
}