// src/app/register-kiosk/page.tsx
import React from "react";

export default async function RegisterKioskPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Next.js 15: searchParams is a Promise
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow ring-1 ring-gray-200">
        <h1 className="text-2xl font-semibold mb-2">Register kiosk</h1>
        <p className="text-gray-600 mb-6">
          Enter your registration key to authorise this device as a kiosk.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 ring-1 ring-red-200">
            {error === "invalid"
              ? "That registration key is invalid or expired."
              : error === "used"
              ? "That registration key has already been used."
              : "Registration failed. Please try again."}
          </div>
        )}

        <form method="POST" action="/api/kiosk/register" className="space-y-4">
          <div>
            <label htmlFor="passphrase" className="block text-sm font-medium">
              Registration key
            </label>
            <input
              id="passphrase"
              name="passphrase"
              required
              autoFocus
              className="mt-1 w-full rounded-lg border px-3 py-2 ring-1 ring-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. ENG-7D-ABCD1234"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-black text-white py-2 hover:bg-gray-900"
          >
            Register this device
          </button>
        </form>
      </div>
    </div>
  );
}
