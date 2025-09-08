import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";

async function doLogout(req: NextRequest) {
  const session = await getAdminSession();
  session.destroy();
  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}

export async function POST(req: NextRequest) {
  return doLogout(req);
}
export async function GET(req: NextRequest) {
  return doLogout(req);
}
