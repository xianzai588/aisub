import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";
import { APP_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

async function signout() {
  const res = NextResponse.redirect(`${APP_URL}/`, 303);
  await clearSessionCookie(res);
  return res;
}

export async function POST(_req: NextRequest) {
  return signout();
}

export async function GET() {
  return signout();
}
