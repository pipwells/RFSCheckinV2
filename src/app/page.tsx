import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          RFS Station Check-In
        </h1>

        <div className="flex flex-col gap-4">
          <Link
            href="/kiosk"
            className="block rounded-md bg-red-600 px-4 py-3 text-center font-medium text-white hover:bg-red-700"
          >
            Open Kiosk
          </Link>

          <Link
            href="/admin"
            className="block rounded-md border px-4 py-3 text-center font-medium text-gray-800 hover:bg-gray-100"
          >
            Admin Login
          </Link>
        </div>

        <p className="mt-6 text-sm text-gray-500 text-center">
          Authorised use only.
        </p>
      </div>
    </main>
  );
}
