import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/lib/daikin/client";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?auth=error&message=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?auth=error&message=missing_code", request.url),
    );
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("daikin_oauth_state")?.value;

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      new URL("/?auth=error&message=invalid_state", request.url),
    );
  }

  cookieStore.delete("daikin_oauth_state");

  try {
    await exchangeAuthorizationCode(code);
    return NextResponse.redirect(new URL("/?auth=success", request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "auth_failed";
    return NextResponse.redirect(
      new URL(`/?auth=error&message=${encodeURIComponent(message)}`, request.url),
    );
  }
}
