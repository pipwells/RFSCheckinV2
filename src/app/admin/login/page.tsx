// src/app/admin/login/page.tsx
import { getAdminSession } from "@/lib/admin-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function AdminLoginPage({
  searchParams,
}: {
  // Next.js 15: searchParams is async in Server Components
  searchParams: Promise<SP>;
}) {
  const session = await getAdminSession();
  const sp = await searchParams;

  const next =
    typeof sp.next === "string" && sp.next.length > 0 ? sp.next : "/admin";
  const error = typeof sp.error === "string" ? sp.error : undefined;

  if (session.user) {
    redirect(next);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        action="/api/auth/login"
        method="POST"
        className="w-full max-w-sm bg-white rounded-2xl p-6 shadow ring-1 ring-gray-200"
      >
        <h1 className="text-2xl font-semibold mb-2">Admin login</h1>
        <p className="text-gray-600 mb-6">
          Sign in with your administrator credentials.
        </p>

        <input type="hidden" name="next" value={next} />

        <label className="block text-sm font-medium mb-2">Username</label>
        <input
          name="username"
          autoComplete="username"
          className="w-full border rounded-lg px-3 py-2 mb-4"
          placeholder="admin"
          required
          autoFocus
        />

        <label className="block text-sm font-medium mb-2">Password</label>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          className="w-full border rounded-lg px-3 py-2 mb-4"
          placeholder="•••••••••••••••"
          required
        />

        {error && (
          <div className="text-sm text-red-600 mb-3" role="alert">
            {error === "invalid"
              ? "Invalid username or password."
              : "Login failed."}
          </div>
        )}

        <button className="w-full rounded-lg px-4 py-2 bg-black text-white">
          Sign in
        </button>
      </form>
    </div>
  );
}
