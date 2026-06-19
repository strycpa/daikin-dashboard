import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/lib/daikin/client";
import { parseOAuthInput } from "@/lib/daikin/oauth";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const rawInput =
      typeof body === "object" &&
      body !== null &&
      "input" in body &&
      typeof body.input === "string"
        ? body.input
        : null;

    if (!rawInput) {
      return NextResponse.json(
        { error: "Missing authorization code input" },
        { status: 400 },
      );
    }

    const { code, state } = parseOAuthInput(rawInput);
    const cookieStore = await cookies();
    const savedState = cookieStore.get("daikin_oauth_state")?.value;

    if (savedState) {
      if (!state) {
        return NextResponse.json(
          {
            error:
              "Chybí state v callback URL. Zkopíruj celou URL z konzole, ne jen code.",
          },
          { status: 400 },
        );
      }
      if (savedState !== state) {
        return NextResponse.json(
          { error: "State nesedí — spusť přihlášení znovu od začátku." },
          { status: 400 },
        );
      }
    }

    cookieStore.delete("daikin_oauth_state");
    await exchangeAuthorizationCode(code);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Token exchange failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
