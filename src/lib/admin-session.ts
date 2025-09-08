import { getIronSession, type SessionOptions, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: "owner" | "admin" | "staff" | "super_admin"; // ✅ include super_admin
  organisationId?: string;
};

// The IronSession generic describes the shape stored in the session.
export type AdminSession = IronSession<{ user?: AdminUser }>;

// Configure cookie/session options
const sessionOptions: SessionOptions = {
  password: process.env.ADMIN_SESSION_PASSWORD ?? "dev-only-insecure-password-change-me",
  cookieName: "admin_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};

/**
 * Get (or create) the admin session using Next.js App Router cookies().
 * Usage (server only):
 *   const session = await getAdminSession();
 *   session.user = {...};
 *   await session.save();
 */
export async function getAdminSession(): Promise<AdminSession> {
  const session = await getIronSession<{ user?: AdminUser }>(cookies(), sessionOptions);
  return session;
}
