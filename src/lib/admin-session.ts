import { getIronSession, type IronSessionOptions } from "iron-session";
import { cookies as getCookies } from "next/headers";

export type AdminUser = {
  id: string;
  email?: string;
  role: "org_admin" | "station_admin" | "super_admin";
  organisationId?: string;
};

export type AdminSession = {
  user?: AdminUser;
};

const sessionOptions: IronSessionOptions = {
  cookieName: "checkin_admin",
  password: process.env.SESSION_PASSWORD!, // 32+ chars
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};

export async function getAdminSession() {
  const cookieStore = await getCookies(); // Next 15: await cookies()
  return getIronSession<AdminSession>(cookieStore, sessionOptions);
}
