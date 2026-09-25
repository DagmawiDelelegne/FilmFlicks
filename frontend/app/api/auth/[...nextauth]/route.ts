import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({token, account, profile }) {
      
      if (account && profile){

        const emailVerified = "email_verified" in profile ? Boolean(profile.email_verified) : false;

        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/sync-user`,{
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "backend-internal-secret": process.env.BACKEND_INTERNAL_SECRET!,
          },
          body: JSON.stringify({
            provider: account.provider,
            provider_user_id: account.providerAccountId,
            email: token.email,
            email_verified: emailVerified, // used emailVerified because of typescript type issue
            name: token.name ?? "",
            picture: token.picture ?? "",
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to sync user with backend");
        }

        const user = await res.json();

        token.userId = user.id;
        token.googleId = account.providerAccountId;
        token.emailVerified = user.email_verified;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as number;
        session.user.googleId = token.googleId as string;
        session.user.emailVerified = token.emailVerified as boolean;
      }

      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };