import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        isRegister: { label: "Is Register", type: "text" },
        firstName: { label: "First Name", type: "text" },
        lastName: { label: "Last Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const isRegister = credentials.isRegister === "true";
        const endpoint = isRegister ? "/api/v1/auth/register" : "/api/v1/auth/login";

        try {
          const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
          const res = await fetch(`${backendUrl}${endpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
              first_name: credentials.firstName || "",
              last_name: credentials.lastName || "",
            }),
          });

          const data = await res.json();

          if (res.ok && data.success && data.user && data.access_token) {
            return {
              id: data.user.id,
              email: data.user.email,
              name: `${data.user.first_name || ""} ${data.user.last_name || ""}`.trim() || data.user.email,
              accessToken: data.access_token,
            };
          } else {
            throw new Error(
              data.detail?.error?.message ||
              data.error?.message ||
              (typeof data.detail === 'string' ? data.detail : "Authentication failed")
            );
          }
        } catch (error: any) {
          throw new Error(error.message || "Something went wrong");
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET as string,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
