// src/app/kiosk/visitor/checkout/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const PURPOSE_OPTIONS = [
  "Meeting Guest",
  "Administration",
  "Maintenance",
  "Interview",
  "Other",
] as const;

type PurposeOption = (typeof PURPOSE_OPTIONS)[number];

type SessionApiResponse = {
  id: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  memberId: string;
  firstName: string;
  lastName: string;
  isVisitor: boolean;
  visitorAgency: string | null;
  visitorPurpose: string | null;
};

type JsonObject = Record<string, unknown>;

function isRecord(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtHM(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function durationString(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

function timeDisplayFromDigits(raw: string) {
  const s = raw.replace(/[^\d]/g, "").slice(0, 4);
  const p = s.padStart(4, "0");
  return `${p.slice(0, 2)}:${p.slice(2)}`;
}

// Audio helpers (typed, Safari-safe, no Window casts)
type AudioContextCtor = new () => AudioContext;

function getAudioCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;

  const g = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };

  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

function beepShortSuccess() {
  try {
    const Ctor = getAudioCtor();
    if (!Ctor) return;

    const ctx = new Ctor();
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = "sine";
    o.frequency.value = 880;

    o.connect(g);
    g.connect(ctx.destination);

    o.start();
    o.stop(ctx.currentTime + 0.14);
  } catch {
    // ignore
  }
}

function parseSessionResponse(
  raw: unknown
): Partial<SessionApiResponse> & { error?: string } {
  if (!isRecord(raw)) return {};

  const out: Partial<SessionApiResponse> & { error?: string } = {};

  const error = getString(raw.error);
  if (error) out.error = error;

  const firstName = getString(raw.firstName);
  if (firstName !== null) out.firstName = firstName;

  const lastName = getString(raw.lastName);
  if (lastName !== null) out.lastName = lastName;

  const startTime = raw.startTime === null ? null : getString(raw.startTime);
  if (startTime !== null || raw.startTime === null) out.startTime = startTime;

  const endTime = raw.endTime === null ? null : getString(raw.endTime);
  if (endTime !== null || raw.endTime === null) out.endTime = endTime;

  const visitorPurpose =
    raw.visitorPurpose === null ? null : getString(raw.visitorPurpose);
  if (visitorPurpose !== null || raw.visitorPurpose === null)
    out.visitorPurpose = visitorPurpose;

  return out;
}

export default function VisitorCheckoutPage() {
  const router = useRouter();
  const params = useSearchParams();

  const sid =
    params.get("sessionId") ||
    params.get("sid") ||
    params.get("id") ||
    params.get("session") ||
    "";

  const [firstName, setFirstName] = useState("Visitor");
  const [lastName, setLastName] = useState("");
  const [purposeSel, setPurposeSel] = useState<PurposeOption | "">("");
  const [purposeOther, setPurposeOther] = useState("");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(new Date());
  const [err, setErr] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<null | "start" | "end">(null);
  const [timeEntry, setTimeEntry] = useState("");
  const [timeError, setTimeError] = useState("");
  const [baseDate, setBaseDate] = useState<Date>(new Date());
  const [dateOffset, setDateOffset] = useState<number>(0);

  function editorDateLabel() {
    const d = addDays(startOfDay(baseDate), dateOffset);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function canNextDay() {
    if (!editing) return false;
    if (editing === "start") {
      const candidate = addDays(startOfDay(baseDate), dateOffset + 1);
      const todayStart = startOfDay(new Date());
      return candidate <= todayStart;
    }
    return true;
  }

  function pressDigit(d: string) {
    setTimeEntry((p) => (p + d).replace(/[^\d]/g, "").slice(0, 4));
  }
  function backspace() {
    setTimeEntry((p) => p.slice(0, -1));
  }
  function clear() {
    setTimeEntry("");
  }

  function openEditor(which: "start" | "end") {
    setEditing(which);
    setTimeEntry("");
    setTimeError("");
    setDateOffset(0);
    setBaseDate(which === "start" ? startTime ?? new Date() : endTime ?? new Date());
  }

  function saveTime() {
    const raw = timeEntry.replace(/[^\d]/g, "");
    if (raw.length === 0) {
      setTimeError("Enter a time (HHmm).");
      return;
    }

    const p = raw.padStart(4, "0");
    const hh = parseInt(p.slice(0, 2), 10);
    const mm = parseInt(p.slice(2), 10);

    if (
      Number.isNaN(hh) ||
      Number.isNaN(mm) ||
      hh < 0 ||
      hh > 23 ||
      mm < 0 ||
      mm > 59
    ) {
      setTimeError("Enter a valid 24-hour time (HHmm).");
      return;
    }

    const chosenDay = addDays(startOfDay(baseDate), dateOffset);
    const candidate = new Date(chosenDay);
    candidate.setHours(hh, mm, 0, 0);

    const now = new Date();
    const maxFuture = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    if (editing === "start") {
      if (candidate > now) {
        setTimeError("Check-in cannot be in the future.");
        return;
      }
      if (endTime && candidate > endTime) {
        setTimeError("Check-in cannot be later than checkout.");
        return;
      }
      setStartTime(candidate);
      if (endTime && endTime < candidate) setEndTime(new Date(candidate));
    } else {
      if (startTime && candidate < startTime) {
        setTimeError("Checkout cannot be earlier than check-in.");
        return;
      }
      if (candidate > maxFuture) {
        setTimeError("Checkout cannot be more than 6 hours in the future.");
        return;
      }
      setEndTime(candidate);
    }

    setEditing(null);
  }

  const purposeValue = useMemo(() => {
    const v = purposeSel === "Other" ? purposeOther.trim() : (purposeSel || "").trim();
    return v;
  }, [purposeSel, purposeOther]);

  useEffect(() => {
    let ignore = false;

    (async () => {
      setErr("");

      if (!sid) {
        setErr("Missing session id.");
        return;
      }

      try {
        const r = await fetch(`/api/kiosk/session?sessionId=${encodeURIComponent(sid)}`, {
          cache: "no-store",
        });

        const raw: unknown = await r.json().catch(() => ({}));
        const d = parseSessionResponse(raw);

        if (!r.ok) {
          setErr(d.error || "Failed to load session");
          return;
        }
        if (ignore) return;

        setFirstName(d.firstName || "Visitor");
        setLastName(d.lastName || "");

        setStartTime(d.startTime ? new Date(d.startTime) : null);
        setEndTime(new Date());

        const p = d.visitorPurpose || "";
        if ((PURPOSE_OPTIONS as readonly string[]).includes(p)) {
          setPurposeSel(p as PurposeOption);
        } else if (p) {
          setPurposeSel("Other");
          setPurposeOther(p);
        }
      } catch {
        setErr("Network error");
      }
    })();

    return () => {
      ignore = true;
    };
  }, [sid]);

  async function submit() {
    setErr("");

    if (!sid) {
      setErr("Missing session id.");
      return;
    }
    if (!startTime || !endTime) {
      setErr("Missing times.");
      return;
    }
    if (!purposeValue) {
      setErr("Please select or enter a purpose.");
      return;
    }

    setBusy(true);

    try {
      const res = await fetch("/api/kiosk/visitor/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          purpose: purposeValue,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      });

      const raw: unknown = await res.json().catch(() => ({}));
      const data = isRecord(raw)
        ? { error: getString(raw.error), ok: typeof raw.ok === "boolean" ? raw.ok : undefined }
        : {};

      if (!res.ok || data.error) {
        setErr(`Checkout failed: ${data.error || "server_error"}`);
        return;
      }

      beepShortSuccess();
      router.push("/kiosk");
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const fullName = `${firstName}${lastName ? " " + lastName : ""}`;
  const dur =
    startTime && endTime ? durationString(endTime.getTime() - startTime.getTime()) : "—";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl p-6 shadow ring-1 ring-gray-200">
        <h1 className="text-3xl font-semibold mb-2">Visitor checkout</h1>
        <p className="text-gray-600 mb-4">Thanks for your time, {fullName || "Visitor"}.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl ring-1 ring-gray-300 shadow">
            <div className="text-sm text-gray-600">Checked in</div>
            <div className="text-3xl font-mono">{startTime ? fmtHM(startTime) : "--:--"}</div>
            <div className="text-sm text-gray-600">
              {startTime
                ? startTime.toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })
                : "—"}
            </div>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => openEditor("start")}
                className="px-4 py-2 rounded-xl ring-1 ring-gray-300 shadow"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl ring-1 ring-gray-300 shadow">
            <div className="text-sm text-gray-600">Checking out</div>
            <div className="text-3xl font-mono">{endTime ? fmtHM(endTime) : "--:--"}</div>
            <div className="text-sm text-gray-600">
              {endTime
                ? endTime.toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })
                : "—"}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEndTime(new Date())}
                className="px-4 py-2 rounded-xl ring-1 ring-gray-300 shadow"
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => openEditor("end")}
                className="px-4 py-2 rounded-xl ring-1 ring-gray-300 shadow"
              >
                Edit
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-3 text-lg text-gray-800">Duration: {dur}</div>

        <div className="mt-6">
          <label className="block text-sm text-gray-600 mb-1">Purpose of visit</label>
          <div className="flex flex-wrap gap-2">
            {PURPOSE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setPurposeSel(opt)}
                className={`px-4 py-2 rounded-xl ring-1 shadow ${
                  purposeSel === opt ? "ring-blue-500" : "ring-gray-300"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {purposeSel === "Other" && (
            <input
              value={purposeOther}
              onChange={(e) => setPurposeOther(e.target.value)}
              className="w-full p-3 rounded-xl ring-1 ring-gray-300 shadow-sm mt-2"
              placeholder="Enter purpose"
            />
          )}
        </div>

        {err && <div className="text-red-600 mt-4">{err}</div>}

        <div className="flex gap-3 justify-end mt-6">
          <a href="/kiosk" className="px-6 py-3 rounded-2xl ring-1 ring-gray-300 shadow">
            Cancel
          </a>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="px-6 py-3 rounded-2xl shadow text-white disabled:opacity-60"
            style={{ backgroundColor: "#5093eb" }}
          >
            {busy ? "Saving…" : "Confirm checkout"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="text-xl mb-4">
              Edit {editing === "start" ? "check-in" : "checkout"} time (24-hour)
            </div>

            <div className="flex items-center justify-center gap-3 mb-3">
              <button
                type="button"
                onClick={() => setDateOffset((d) => d - 1)}
                className="px-4 py-2 rounded-xl ring-1 ring-gray-300 shadow"
              >
                ◀ Prev day
              </button>
              <div className="text-xl">{editorDateLabel()}</div>
              <button
                type="button"
                onClick={() => canNextDay() && setDateOffset((d) => d + 1)}
                className={`px-4 py-2 rounded-xl ring-1 ring-gray-300 shadow ${
                  !canNextDay() ? "opacity-40 cursor-not-allowed" : ""
                }`}
              >
                Next day ▶
              </button>
            </div>

            <div className="text-center text-5xl font-mono tracking-widest">
              {timeDisplayFromDigits(timeEntry)}
            </div>
            {timeError && <div className="text-center text-red-600">{timeError}</div>}

            <div className="grid grid-cols-3 gap-3 my-4">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "⌫"].map((k) =>
                k === "CLR" ? (
                  <button
                    key={k}
                    onClick={() => clear()}
                    className="p-6 text-2xl rounded-2xl ring-1 ring-gray-300 shadow"
                  >
                    CLR
                  </button>
                ) : k === "⌫" ? (
                  <button
                    key={k}
                    onClick={() => backspace()}
                    className="p-6 text-2xl rounded-2xl ring-1 ring-gray-300 shadow"
                  >
                    ⌫
                  </button>
                ) : (
                  <button
                    key={k}
                    onClick={() => pressDigit(k)}
                    className="p-6 text-2xl rounded-2xl ring-1 ring-gray-300 shadow"
                  >
                    {k}
                  </button>
                )
              )}
            </div>

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={saveTime}
                className="px-6 py-3 text-xl rounded-2xl shadow ring-1 ring-gray-300"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-6 py-3 text-xl rounded-2xl shadow ring-1 ring-gray-300"
              >
                Cancel
              </button>
            </div>

            <div className="text-center text-sm text-gray-600 pt-2">
              {editing === "start"
                ? "Check-in cannot be in the future."
                : "Checkout may be up to 6 hours in the future."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
