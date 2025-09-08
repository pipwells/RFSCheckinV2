import { getIronSession, type SessionOptions, type IronSession } from "iron-session";
import { cookies as getCookies } from "next/headers";

export type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: "owner" | "admin" | "staff";
};

export type AdminSession = IronSession & {
  user?: AdminUser;
};

// Configure your cookie. Ensure the password is set in env for prod.
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
 *   session.user = {...}; // set or read
 *   await session.save();
 */
export async function getAdminSession(): Promise<AdminSession> {
  // In App Router, pass the cookies() read-only store to iron-session:
  const cookieStore = getCookies();
  // The generic <{ user?: AdminUser }> helps with intellisense even without the AdminSession type
  const session = await getIronSession<{ user?: AdminUser }>(cookieStore, sessionOptions);
  // Cast to AdminSession to expose .save(), .destroy(), etc.
  return session as AdminSession;
}
