import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export default withAuth(
  async function middleware(req) {
    if (req.nextUrl.pathname.startsWith("/api/v1/")) {
      // Don't intercept auth endpoints
      if (req.nextUrl.pathname.startsWith("/api/v1/auth/")) {
        return NextResponse.next();
      }

      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || "super-secret-key-for-dev-only-change-in-prod" });
      
      const requestHeaders = new Headers(req.headers);
      if (token?.accessToken) {
        requestHeaders.set("Authorization", `Bearer ${token.accessToken}`);
      }

      const backendUrl = new URL(req.nextUrl.pathname, "http://127.0.0.1:8000");
      backendUrl.search = req.nextUrl.search;

      return NextResponse.rewrite(backendUrl, {
        request: {
          headers: requestHeaders,
        },
      });
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // Allow unauthenticated access to the login page and auth API
        if (req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/api/auth/")) {
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
