// src/app/api/kiosk/reset/route.ts
import { NextRequest, NextResponse } from "next/server";

function toURL(path: string, req: NextRequest) {
  // Build an absolute URL for the redirect
  return new URL(path, req.url);
}

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(toURL("/register-kiosk", req), 303);
  res.cookies.set("kiosk_key", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0, // expire immediately
  });
  return res;
}

export async function POST(req: NextRequest) {
  // Support POST as well, e.g. from a form/button
  return GET(req);
}
