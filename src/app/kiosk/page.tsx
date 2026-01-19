"use client";

/**
 * KIOSK PAGE
 * - Keyboard-wedge RFID input (keeps focus)
 * - Scan supports RFID tag / Member No. / Mobile (with ambiguity selection)
 * - Sidebar shows who is currently in station
 * - Checkout panel (requires activity selection before confirm)
 *
 * Landmarks:
 *   [LANDMARK: imports]
 *   [LANDMARK: audio helpers]
 *   [LANDMARK: types]
 *   [LANDMARK: helpers]
 *   [LANDMARK: data fetchers]
 *   [LANDMARK: state]
 *   [LANDMARK: effects]
 *   [LANDMARK: actions]
 *   [LANDMARK: UI]
 */

// [LANDMARK: imports]
import React from "react";
import { useRouter } from "next/navigation";

// -----------------------------
// [LANDMARK: audio helpers]
// -----------------------------
let audioCtx: AudioContext | null = null;

type AudioContextCtor = new () => AudioContext;

function getAudioCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;

  const g = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };

  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

function ensureAudio() {
  const Ctor = getAudioCtor();
  if (!Ctor) return null;

  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

async function tone(
  freq: number,
  ms: number,
  type: OscillatorType = "sine",
  gain = 0.05
) {
  const ctx = ensureAudio();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const g = ctx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  g.gain.value = gain;

  osc.connect(g);
  g.connect(ctx.destination);

  osc.start();
  await new Promise((r) => setTimeout(r, ms));
  osc.stop();
}

async function beepPositive() {
  await tone(880, 90, "sine", 0.08);
  await tone(1320, 120, "sine", 0.08);
}

async function beepNegative() {
  await tone(220, 160, "sawtooth", 0.09);
  await tone(160, 140, "sawtooth", 0.09);
}

async function beepDouble() {
  await tone(1040, 90, "triangle", 0.08);
  await new Promise((r) => setTimeout(r, 90));
  await tone(1040, 90, "triangle", 0.08);
}


// -----------------------------
// [LANDMARK: types]
// -----------------------------
type ActiveEntry = {
  id: string;
  memberId: string;
  firstName: string;
  isVisitor?: boolean;
  startTime: string; // ISO
};

type ChildCat = { id: string; name: string; code: string };
type ParentCat = { id: string; name: string; code: string; children: ChildCat[] };

type AmbiguousCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string;
};

type KioskCategoriesResponse =
  | ParentCat[]
  | {
      categories?: ParentCat[];
    };

type KioskActiveResponse =
  | ActiveEntry[]
  | {
      sessions?: unknown;
    }
  | Record<string, unknown>;

// -----------------------------
// [LANDMARK: helpers]
// -----------------------------
function durationMins(aIso: string, bIso?: string) {
  const a = new Date(aIso).getTime();
  const b = bIso ? new Date(bIso).getTime() : Date.now();
  return Math.max(0, Math.round((b - a) / 60000));
}

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtClock(d: Date) {
  const HH = d.getHours().toString().padStart(2, "0");
  const MM = d.getMinutes().toString().padStart(2, "0");
  return `${HH}:${MM}`;
}

function roundMinutesTo10(mins: number) {
  return Math.max(0, Math.round(mins / 10) * 10);
}

// -----------------------------
// [LANDMARK: data fetchers]
// -----------------------------
async function fetchCategories(): Promise<ParentCat[]> {
  try {
    const res = await fetch("/api/kiosk/categories", { cache: "no-store" });
    if (!res.ok) return [];

    const data = (await res.json().catch(() => ({}))) as KioskCategoriesResponse;
    const cats: ParentCat[] = Array.isArray(data) ? data : data.categories ?? [];

    // Defensive: ensure at least one child so checkout always has a selectable category.
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      children:
        Array.isArray(c.children) && c.children.length > 0
          ? c.children.map((ch) => ({ id: ch.id, name: ch.name, code: ch.code }))
          : [{ id: c.id, name: c.name, code: c.code }],
    }));
  } catch {
    return [];
  }
}

function toActiveEntries(input: unknown): ActiveEntry[] {
  if (Array.isArray(input)) {
    return input.map((s) => {
      const obj = s as Record<string, unknown>;

      const rawId =
        obj.id ??
        obj.sessionId ??
        obj.session_id ??
        `${(obj.member as Record<string, unknown> | undefined)?.id ?? obj.memberId ?? "m"}:${
          obj.startTime ?? obj.startedAt ?? obj.start ?? "t"
        }`;

      const member = (obj.member as Record<string, unknown> | undefined) ?? undefined;

      return {
        id: String(rawId),
        memberId: String((obj.memberId ?? member?.id ?? "") || ""),
        firstName: String((obj.firstName ?? member?.firstName ?? member?.name ?? "Guest") || "Guest"),
        isVisitor: Boolean(obj.isVisitor ?? member?.isVisitor),
        startTime: String((obj.startTime ?? obj.startedAt ?? obj.start ?? new Date().toISOString()) || new Date().toISOString()),
      };
    });
  }
  return [];
}

async function fetchActive(): Promise<ActiveEntry[]> {
  try {
    const res = await fetch("/api/kiosk/active", { cache: "no-store" });
    if (!res.ok) return [];

    const data = (await res.json().catch(() => ({}))) as KioskActiveResponse;

    if (Array.isArray(data)) return toActiveEntries(data);

    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;

      if (Array.isArray(obj.sessions)) return toActiveEntries(obj.sessions);

      if (obj.sessions && typeof obj.sessions === "object") {
        return toActiveEntries(Object.values(obj.sessions as Record<string, unknown>));
      }

      const maybeArray = Object.values(obj).find((v) => Array.isArray(v));
      if (Array.isArray(maybeArray)) return toActiveEntries(maybeArray);
    }

    return [];
  } catch {
    return [];
  }
}

// --------------------------------------------------
// [LANDMARK: state]
// --------------------------------------------------
export default function KioskPage() {
  const router = useRouter();

  const entryRef = React.useRef<HTMLInputElement>(null);
  const [entry, setEntry] = React.useState("");
  const [working, setWorking] = React.useState(false);

  const [active, setActive] = React.useState<ActiveEntry[]>([]);
  const [categories, setCategories] = React.useState<ParentCat[]>([]);

  const [greetName, setGreetName] = React.useState<string | null>(null);
  const greetTimerRef = React.useRef<number | null>(null);

  const [ambiguous, setAmbiguous] = React.useState<AmbiguousCandidate[] | null>(null);

  const [checkoutSession, setCheckoutSession] = React.useState<{
    sessionId: string;
    firstName: string;
    startISO: string;
    isVisitor?: boolean;
  } | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);

  // --------------------------------------------------
  // [LANDMARK: effects]
  // --------------------------------------------------
  React.useEffect(() => {
    let mounted = true;

    async function load() {
      const [a, c] = await Promise.all([fetchActive(), fetchCategories()]);
      if (!mounted) return;
      setActive(a);
      setCategories(c);
    }
    load();

    const poll = window.setInterval(async () => {
      if (!mounted) return;
      setActive(await fetchActive());
    }, 4000);

    const tick = window.setInterval(() => {
      // keep durations live
      setActive((prev) => [...prev]);
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  // Keep keypad input focused for keyboard-wedge RFID
  React.useEffect(() => {
    const t = window.setInterval(() => {
      if (!entryRef.current) return;

      // Don’t steal focus if user is clicking buttons.
      const el = document.activeElement as HTMLElement | null;
      const tag = (el?.tagName || "").toLowerCase();
      if (tag === "button" || tag === "select" || tag === "textarea") return;

      entryRef.current.focus();
    }, 600);

    return () => clearInterval(t);
  }, []);

  // Greeting timer
  React.useEffect(() => {
    if (!greetName) return;

    if (greetTimerRef.current) window.clearTimeout(greetTimerRef.current);
    greetTimerRef.current = window.setTimeout(() => setGreetName(null), 3000);

    return () => {
      if (greetTimerRef.current) window.clearTimeout(greetTimerRef.current);
      greetTimerRef.current = null;
    };
  }, [greetName]);

  // --------------------------------------------------
  // [LANDMARK: actions]
  // --------------------------------------------------
  async function submitScan() {
    const raw = entry.trim();
    if (!raw || working) return;

    setWorking(true);
    setAmbiguous(null);

    try {
      const res = await fetch("/api/kiosk/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: raw }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (data.error === "no_kiosk" || data.error === "invalid_kiosk") {
        await beepNegative();
        alert("This device is not registered as a kiosk.");
        return;
      }

      if (data.error === "disabled" || data.status === "unknown") {
        await beepNegative();
        setEntry("");
        return;
      }

      if (data.status === "ambiguous" && Array.isArray(data.candidates)) {
        setAmbiguous(data.candidates as AmbiguousCandidate[]);
        setEntry("");
        return;
      }

      if (data.status === "already_in") {
        setCheckoutSession({
          sessionId: String(data.sessionId),
          firstName: (data.firstName as string | undefined) ?? "Member",
          startISO: String(data.startTime),
          isVisitor: false,
        });
        setSelectedCategoryId(null);
        setEntry("");
        return;
      }

      if (data.status === "checked_in") {
        await beepPositive();
        setGreetName((data.firstName as string | undefined) ?? "Member");
        setEntry("");
        setTimeout(async () => setActive(await fetchActive()), 250);
        return;
      }

      await beepNegative();
      setEntry("");
    } catch (e) {
      console.error("scan error", e);
      await beepNegative();
    } finally {
      setWorking(false);
      window.setTimeout(() => entryRef.current?.focus(), 50);
    }
  }

  async function submitScanAs(memberId: string) {
    if (!memberId || working) return;

    setWorking(true);

    try {
      const res = await fetch("/api/kiosk/scan-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      setAmbiguous(null);

      if (data.error === "no_kiosk" || data.error === "invalid_kiosk") {
        await beepNegative();
        alert("This device is not registered as a kiosk.");
        return;
      }

      if (data.error === "disabled" || data.status === "unknown") {
        await beepNegative();
        return;
      }

      if (data.status === "already_in") {
        setCheckoutSession({
          sessionId: String(data.sessionId),
          firstName: (data.firstName as string | undefined) ?? "Member",
          startISO: String(data.startTime),
          isVisitor: false,
        });
        setSelectedCategoryId(null);
        return;
      }

      if (data.status === "checked_in") {
        await beepPositive();
        setGreetName((data.firstName as string | undefined) ?? "Member");
        setTimeout(async () => setActive(await fetchActive()), 250);
        return;
      }

      await beepNegative();
    } catch (e) {
      console.error("scan-as error", e);
      await beepNegative();
    } finally {
      setWorking(false);
      window.setTimeout(() => entryRef.current?.focus(), 50);
    }
  }

  function startCheckoutFromSidebar(item: ActiveEntry) {
    if (item.isVisitor) {
      router.push(`/kiosk/visitor/checkout?sessionId=${encodeURIComponent(item.id)}`);
      return;
    }

    setCheckoutSession({
      sessionId: item.id,
      firstName: item.firstName ?? "Member",
      startISO: item.startTime,
      isVisitor: false,
    });
    setSelectedCategoryId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirmCheckout() {
    if (!checkoutSession || working) return;

    // Require activity selection (UI also enforces this)
    if (!selectedCategoryId) {
      await beepNegative();
      return;
    }

    setWorking(true);

    try {
      const startISO = checkoutSession.startISO;
      const endISO = new Date().toISOString();
      const minutes = roundMinutesTo10(durationMins(startISO, endISO));

      const res = await fetch("/api/kiosk/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: checkoutSession.sessionId,
          startTime: startISO,
          endTime: endISO,
          minutes,
          tasks: [{ categoryId: selectedCategoryId }],
        }),
      });

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (data?.status === "checked_out") {
        await beepDouble();
        setCheckoutSession(null);
        setSelectedCategoryId(null);
        setTimeout(async () => setActive(await fetchActive()), 250);
        return;
      }

      await beepNegative();
    } catch (e) {
      console.error("checkout error", e);
      await beepNegative();
    } finally {
      setWorking(false);
      window.setTimeout(() => entryRef.current?.focus(), 50);
    }
  }

  const canConfirmCheckout = !!checkoutSession && !!selectedCategoryId && !working;

  // --------------------------------------------------
  // [LANDMARK: UI]
  // --------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Greeting banner */}
        {greetName && (
          <div className="mb-4 rounded-lg bg-emerald-900/40 border border-emerald-700 px-4 py-3">
            <div className="text-lg font-semibold">Welcome, {greetName}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sidebar */}
          <div className="lg:col-span-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="mb-2 text-sm font-semibold text-zinc-200">Currently in station</div>

            <div className="space-y-2">
              {active
                .filter((a) => !a.isVisitor)
                .map((a) => (
                  <button
                    key={a.id}
                    onClick={() => startCheckoutFromSidebar(a)}
                    className="w-full text-left rounded-md border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-950 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{a.firstName}</div>
                      <div className="text-xs text-zinc-300">{fmtDuration(durationMins(a.startTime))}</div>
                    </div>
                    <div className="text-xs text-zinc-400">Checked in: {fmtClock(new Date(a.startTime))}</div>
                  </button>
                ))}

              <div className="pt-3 mt-3 border-t border-zinc-800">
                <div className="mb-2 text-sm font-semibold text-zinc-200">Visitors</div>
                {active
                  .filter((a) => !!a.isVisitor)
                  .map((a) => (
                    <button
                      key={a.id}
                      onClick={() => startCheckoutFromSidebar(a)}
                      className="w-full text-left rounded-md border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-950 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{a.firstName}</div>
                        <div className="text-xs text-zinc-300">{fmtDuration(durationMins(a.startTime))}</div>
                      </div>
                      <div className="text-xs text-zinc-400">Checked in: {fmtClock(new Date(a.startTime))}</div>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="lg:col-span-2 space-y-4">
            {/* Check-in panel */}
            {!checkoutSession && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">Member check-in</div>
                    <div className="text-sm text-zinc-300">Scan RFID, enter Member No., or enter Mobile.</div>
                  </div>
                  <div className="text-xs text-zinc-400">{working ? "Working..." : "Ready"}</div>
                </div>

                <input
                  ref={entryRef}
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitScan();
                  }}
                  className="mt-3 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-lg tracking-wide outline-none focus:border-emerald-600"
                  placeholder="RFID / Member No. / Mobile"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                />

                {/* Ambiguous mobile selection */}
                {ambiguous && ambiguous.length > 0 && (
                  <div className="mt-3 rounded-md border border-amber-700 bg-amber-900/20 p-3">
                    <div className="text-sm font-semibold text-amber-100">Mobile is shared — select member</div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ambiguous.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => submitScanAs(m.id)}
                          className="rounded-md border border-amber-700 bg-amber-950/40 hover:bg-amber-950 px-3 py-3 text-left"
                        >
                          <div className="font-semibold">
                            {m.firstName} {m.lastName}
                          </div>
                          <div className="text-xs text-amber-200">Member No.: {m.memberNumber}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Keypad */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "OK"].map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        if (working) return;
                        if (k === "CLR") {
                          setEntry("");
                          setAmbiguous(null);
                          entryRef.current?.focus();
                          return;
                        }
                        if (k === "OK") {
                          submitScan();
                          return;
                        }
                        setEntry((prev) => `${prev}${k}`);
                        entryRef.current?.focus();
                      }}
                      className="rounded-md border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950 px-3 py-4 text-lg font-semibold"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Checkout panel */}
            {checkoutSession && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">Checkout: {checkoutSession.firstName}</div>
                    <div className="text-sm text-zinc-300">
                      Session duration: {fmtDuration(durationMins(checkoutSession.startISO))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setCheckoutSession(null);
                      setSelectedCategoryId(null);
                      window.setTimeout(() => entryRef.current?.focus(), 50);
                    }}
                    className="rounded-md border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950 px-3 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="text-sm font-semibold mb-2">What did you do?</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categories.flatMap((p) => p.children).map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => setSelectedCategoryId(ch.id)}
                        className={`rounded-md border px-3 py-3 text-left ${
                          selectedCategoryId === ch.id
                            ? "border-emerald-600 bg-emerald-950/40"
                            : "border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950"
                        }`}
                      >
                        <div className="font-semibold">{ch.name}</div>
                        <div className="text-xs text-zinc-400">{ch.code}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-zinc-400">
                    Rounded minutes: {roundMinutesTo10(durationMins(checkoutSession.startISO))}m
                  </div>

                  <button
                    onClick={confirmCheckout}
                    disabled={!canConfirmCheckout}
                    className={`rounded-md border px-4 py-3 font-semibold ${
                      canConfirmCheckout
                        ? "border-emerald-700 bg-emerald-900/30 hover:bg-emerald-900/50"
                        : "border-zinc-700 bg-zinc-900/30 text-zinc-400 cursor-not-allowed"
                    }`}
                  >
                    Confirm checkout
                  </button>
                </div>
              </div>
            )}

            {/* Visitor check-in */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Visitor check-in</div>
                  <div className="text-sm text-zinc-300">Sign in visitors and contractors.</div>
                </div>
                <button
                  onClick={() => router.push("/kiosk/visitor")}
                  className="rounded-md border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950 px-4 py-2"
                >
                  Visitor check-in
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}
