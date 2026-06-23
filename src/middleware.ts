import { NextRequest, NextResponse } from "next/server";

function isAuthorized(request: NextRequest, accessToken: string): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${accessToken}`) {
    return true;
  }

  if (authHeader?.startsWith("Basic ")) {
    const encoded = authHeader.slice("Basic ".length);
    try {
      const decoded = atob(encoded);
      const separator = decoded.indexOf(":");
      const password =
        separator >= 0 ? decoded.slice(separator + 1) : decoded;
      return password === accessToken;
    } catch {
      return false;
    }
  }

  return request.cookies.get("dashboard_access")?.value === accessToken;
}

export function middleware(request: NextRequest) {
  const accessToken = process.env.DASHBOARD_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname === "/api/health" || pathname === "/api/auth/callback") {
    return NextResponse.next();
  }

  if (isAuthorized(request, accessToken)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Daikin Dashboard"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
