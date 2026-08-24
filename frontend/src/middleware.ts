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

      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET as string });
      
      const requestHeaders = new Headers(req.headers);
      if (token?.accessToken) {
        requestHeaders.set("Authorization", `Bearer ${token.accessToken}`);
      }

      return NextResponse.next({
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
