"use client"

import Navigation from "@/components/Navigation";
import {useSession} from "next-auth/react"
import { useRouter } from "next/navigation";
import { useEffect } from "react";



export default function AppLayout({ children }: { children: React.ReactNode }) {
  
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return null;
  }
  
  if (!session) {
    return null;
  }
  
  return (
    <main className="min-h-screen bg-black text-white pt-20">
      <Navigation/>
      {children}
    </main>
  );
}