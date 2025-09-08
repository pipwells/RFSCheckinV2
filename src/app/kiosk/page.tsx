"use client";

/**
 * KIOSK PAGE (centered layout + visitors pinned to bottom + drill-down categories)
 * --------------------------------------------------------------------------------
 * Landmarks:
 *   [LANDMARK: imports]
 *   [LANDMARK: audio helpers]
 *   [LANDMARK: types]
 *   [LANDMARK: helpers - time + formatting]
 *   [LANDMARK: data fetchers]
 *   [LANDMARK: component state]
 *   [LANDMARK: effects - polling + autofocus + greeting timer]
 *   [LANDMARK: actions - scan / sidebar checkout / time edits / confirm checkout]
 *   [LANDMARK: UI - layout scaffold]
 *   [LANDMARK: sidebar - members top / visitors bottom]
 *   [LANDMARK: checkin keypad panel]
 *   [LANDMARK: greeting banner]
 *   [LANDMARK: member checkout panel + drill-down category picker]
 *   [LANDMARK: visitor button]
 */

// [LANDMARK: imports]
import React from "react";
import { useRouter } from "next/navigation";

// -----------------------------
// [LANDMARK: audio helpers]
// -----------------------------
let audioCtx: AudioContext | null = null;

function ensureAudio() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
}
async function tone(freq: number, ms: number, type: OscillatorType = "sine", gain = 0.05) {
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

// -----------------------------
// [LANDMARK: helpers - time + formatting]
// -----------------------------
function roundMinutesTo10(mins: number) {
  return Math.max(0, Math.round(mins / 10) * 10);
}
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
function fmtDate(d: Date) {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
    .getDate()
    .toString()
    .padStart(2, "0")}`;
}
function dateAtTime(date: Date, hhmm: string) {
  const h = parseInt(hhmm.slice(0, 2), 10) || 0;
  const m = parseInt(hhmm.slice(2, 4), 10) || 0;
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}
function parseFlexibleHHmm(seq: string): string | null {
  const s = seq.replace(/[^0-9]/g, "");
  if (s.length !== 4) return null;
  const hh = parseInt(s.slice(0, 2), 10);
  const mm = parseInt(s.slice(2, 4), 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return s;
}

// -----------------------------
// [LANDMARK: data fetchers]
// -----------------------------
async function fetchCategories(): Promise<ParentCat[]> {
  try {
    const res = await fetch("/api/kiosk/categories", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const cats: ParentCat[] = Array.isArray(data) ? data : data.categories ?? [];
    // Ensure child fallback if API didn’t add it (defensive)
    return cats.map((c: any) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      children:
        Array.isArray(c.children) && c.children.length > 0
          ? c.children.map((ch: any) => ({ id: ch.id, name: ch.name, code: ch.code }))
          : [{ id: c.id, name: c.name, code: c.code }],
    }));
  } catch {
    return [];
  }
}

async function fetchActive(): Promise<ActiveEntry[]> {
  try {
    const res = await fetch("/api/kiosk/active", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();

    // Normalize to an array
    let sessionsRaw: any[] = [];
    if (Array.isArray(data)) {
      sessionsRaw = data;
    } else if (Array.isArray((data as any)?.sessions)) {
      sessionsRaw = (data as any).sessions;
    } else if ((data as any)?.sessions && typeof (data as any).sessions === "object") {
      sessionsRaw = Object.values((data as any).sessions);
    } else if (data && typeof data === "object") {
      const maybeArray = Object.values(data).find((v) => Array.isArray(v));
      if (Array.isArray(maybeArray)) sessionsRaw = maybeArray;
    }

    if (!Array.isArray(sessionsRaw)) sessionsRaw = [];

    return sessionsRaw.map((s: any) => {
      const rawId =
        s.id ??
        s.sessionId ??
        s.session_id ??
        `${s.member?.id ?? s.memberId ?? "m"}:${s.startTime ?? s.startedAt ?? s.start ?? "t"}`;

      return {
        id: String(rawId),
        memberId: s.memberId ?? s.member?.id ?? "",
        firstName: s.firstName ?? s.member?.firstName ?? s.member?.name ?? "Guest",
        isVisitor: !!(s.isVisitor ?? s.member?.isVisitor),
        startTime: s.startTime ?? s.startedAt ?? s.start ?? new Date().toISOString(),
      } as ActiveEntry;
    });
  } catch {
    return [];
  }
}

// --------------------------------------------------
// [LANDMARK: component state]
// --------------------------------------------------
export default function KioskPage() {
  const router = useRouter();

  // Checkin keypad
  const [entry, setEntry] = React.useState<string>("");
  const entryRef = React.useRef<HTMLInputElement>(null);
  const [working, setWorking] = React.useState(false);

  // Greeting (auto-hide after 3 seconds)
  const [greetName, setGreetName] = React.useState<string | null>(null);
  const greetTimerRef = React.useRef<number | null>(null);

  // Active sidebar
  const [active, setActive] = React.useState<ActiveEntry[]>([]);
  const [nowTick, setNowTick] = React.useState(0); // for durations

  // Categories (drill-down)
  const [categories, setCategories] = React.useState<ParentCat[]>([]);
  const [activeParentId, setActiveParentId] = React.useState<string | null>(null);
  const [selectedChildCategoryId, setSelectedChildCategoryId] = React.useState<string | null>(null);

  // Checkout context (set when user taps their name or scans while “already in”)
  const [checkoutSession, setCheckoutSession] = React.useState<{
    sessionId: string;
    firstName: string;
    startISO: string;
    isVisitor?: boolean;
  } | null>(null);

  // Edited times (start/end)
  const [editStartDate, setEditStartDate] = React.useState<Date | null>(null);
  const [editEndDate, setEditEndDate] = React.useState<Date | null>(null);
  const [startDigits, setStartDigits] = React.useState<string>(""); // "HHmm" logical
  const [endDigits, setEndDigits] = React.useState<string>("");

  // --------------------------------------------------
  // [LANDMARK: effects - polling + autofocus + greeting timer]
  // --------------------------------------------------
  React.useEffect(() => {
    entryRef.current?.focus();
  }, []);

  React.useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]));

    // First active fetch, then poll
    let mounted = true;
    const load = async () => mounted && setActive(await fetchActive());
    load();
    const poll = setInterval(load, 12_000);
    const tick = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => {
      mounted = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  React.useEffect(() => {
    if (greetName) {
      if (greetTimerRef.current) window.clearTimeout(greetTimerRef.current);
      greetTimerRef.current = window.setTimeout(() => setGreetName(null), 3000);
    }
    return () => {
      if (greetTimerRef.current) {
        window.clearTimeout(greetTimerRef.current);
        greetTimerRef.current = null;
      }
    };
  }, [greetName]);

  // --------------------------------------------------
  // [LANDMARK: actions - scan / sidebar checkout / time edits / confirm checkout]
  // --------------------------------------------------
  async function submitScan() {
    if (!entry) return;
    setWorking(true);
    try {
      const res = await fetch("/api/kiosk/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: entry }),
      });
      const data = await res.json();

      if (data.error === "no_kiosk" || data.error === "invalid_kiosk") {
        await beepNegative();
        alert("This device is not registered as a kiosk.");
        setWorking(false);
        return;
      }

      if (data.status === "unknown") {
        await beepNegative();
        setEntry(""); // clear invalid immediately
        entryRef.current?.focus();
        setWorking(false);
        return;
      }

      if (data.error === "disabled") {
        await beepNegative();
        setEntry("");
        setWorking(false);
        return;
      }

      if (data.status === "already_in") {
        // Set up checkout screen with current session
        setCheckoutSession({
          sessionId: data.sessionId,
          firstName: data.firstName ?? "Member",
          startISO: data.startTime,
          isVisitor: false,
        });
        const startD = new Date(data.startTime);
        const endD = new Date();
        setEditStartDate(startD);
        setEditEndDate(endD);
        setStartDigits(fmtClock(startD).replace(":", ""));
        setEndDigits(fmtClock(endD).replace(":", ""));

        // Reset category drill-down
        setActiveParentId(null);
        setSelectedChildCategoryId(null);

        setEntry("");
        setWorking(false);
        return;
      }

      if (data.status === "checked_in") {
        await beepPositive();
        setGreetName(data.firstName ?? "Member");
        setEntry("");
        // Refresh active list soon
        setTimeout(async () => setActive(await fetchActive()), 300);
        setWorking(false);
        return;
      }

      // Fallback
      await beepNegative();
      setEntry("");
    } catch (e) {
      console.error("scan error", e);
      await beepNegative();
    } finally {
      setWorking(false);
    }
  }

  function startCheckoutFromSidebar(item: ActiveEntry) {
    // Visitors go to dedicated visitor checkout flow
    if (item.isVisitor) {
      router.push(`/kiosk/visitor/checkout?sessionId=${encodeURIComponent(item.id)}`);
      return;
    }

    // Members use local member checkout flow
    setCheckoutSession({
      sessionId: item.id,
      firstName: item.firstName ?? "Member",
      startISO: item.startTime,
      isVisitor: item.isVisitor,
    });
    const startD = new Date(item.startTime);
    const endD = new Date();
    setEditStartDate(startD);
    setEditEndDate(endD);
    setStartDigits(fmtClock(startD).replace(":", ""));
    setEndDigits(fmtClock(endD).replace(":", ""));

    // Reset category drill-down
    setActiveParentId(null);
    setSelectedChildCategoryId(null);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // keypad-style right-fill for "HHmm"
  function pushDigitRightFill(current: string, d: string) {
    const digits = (current || "0000").padStart(4, "0").slice(-4).split("");
    digits.shift();
    digits.push(d);
    return digits.join("");
  }

  function canEditTimes() {
    return checkoutSession && !checkoutSession.isVisitor;
  }

  function setStartFromDigits(next: string, dateBase: Date | null) {
    setStartDigits(next);
    const hhmm = parseFlexibleHHmm(next);
    if (!hhmm || !dateBase) return;
    const dt = dateAtTime(dateBase, hhmm);
    if (dt.getTime() > Date.now()) return; // no future start
    setEditStartDate(dt);
  }

  function setEndFromDigits(next: string, dateBase: Date | null) {
    setEndDigits(next);
    const hhmm = parseFlexibleHHmm(next);
    if (!hhmm || !dateBase) return;
    const dt = dateAtTime(dateBase, hhmm);
    if (dt.getTime() > Date.now() + 6 * 3600_000) return; // allow up to +6h
    setEditEndDate(dt);
  }

  function adjustStartDate(days: number) {
    if (!editStartDate) return;
    const d = new Date(editStartDate);
    d.setDate(d.getDate() + days);
    if (d.getTime() > Date.now()) return;
    setEditStartDate(d);
  }
  function adjustEndDate(days: number) {
    if (!editEndDate) return;
    const d = new Date(editEndDate);
    d.setDate(d.getDate() + days);
    if (d.getTime() > Date.now() + 6 * 3600_000) return;
    setEditEndDate(d);
  }

  async function submitCheckout() {
    if (!checkoutSession) return;

    // Guests have a separate flow (visitor pages), guard just in case.
    if (checkoutSession.isVisitor) {
      await beepNegative();
      alert("Use the visitor checkout flow for guests.");
      return;
    }

    // Must select a **subcategory** before confirming
    if (!selectedChildCategoryId) {
      await beepNegative();
      return;
    }

    const start = editStartDate ?? new Date(checkoutSession.startISO);
    const end = editEndDate ?? new Date();
    if (end.getTime() <= start.getTime()) {
      await beepNegative();
      return;
    }

    try {
      const res = await fetch("/api/kiosk/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: checkoutSession.sessionId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          tasks: [{ categoryId: selectedChildCategoryId }],
        }),
      });
      const data = await res.json();
      if (data.status === "checked_out") {
        await beepDouble();
        setCheckoutSession(null);
        setSelectedChildCategoryId(null);
        setActive(await fetchActive()); // refresh sidebar quickly
      } else {
        await beepNegative();
      }
    } catch (e) {
      console.error("checkout error", e);
      await beepNegative();
    }
  }

  // --------------------------------------------------
  // [LANDMARK: UI - layout scaffold]
  // --------------------------------------------------
  return (
    <div className="min-h-screen flex">
      {/* [LANDMARK: sidebar - members top / visitors bottom] */}
      <aside className="hidden md:flex md:flex-col w-80 p-4 bg-gray-50 border-r">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Currently checked in</h2>
          <div className="text-xs text-gray-500">{fmtClock(new Date())}</div>
        </div>

        {/* Members (top) */}
        <div className="space-y-1">
          {active.filter((a) => !a.isVisitor).length === 0 ? (
            <div className="text-sm text-gray-500 italic opacity-70">No members checked in.</div>
          ) : (
            active
              .filter((a) => !a.isVisitor)
              .map((a, idx) => {
                const mins = roundMinutesTo10(durationMins(a.startTime));
                const safeKey = a.id || `${a.memberId}-${a.startTime}-${idx}`;
                return (
                  <button
                    key={safeKey}
                    onClick={() => startCheckoutFromSidebar(a)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white ring-1 ring-gray-200 hover:ring-gray-300"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.firstName}</span>
                      <span className="text-xs text-gray-600">{fmtDuration(mins)}</span>
                    </div>
                  </button>
                );
              })
          )}
        </div>

        {/* Spacer pushes visitors to bottom */}
        <div className="mt-3 flex-1" />

        {/* Visitors (bottom) */}
        <div className="space-y-1">
          {active.filter((a) => a.isVisitor).length === 0 ? null : (
            <>
              <div className="text-xs uppercase tracking-wide text-blue-700/80 mb-1">Visitors</div>
              {active
                .filter((a) => a.isVisitor)
                .map((a, idx) => {
                  const mins = roundMinutesTo10(durationMins(a.startTime));
                  const safeKey = a.id || `${a.memberId}-${a.startTime}-${idx}`;
                  return (
                    <button
                      key={safeKey}
                      onClick={() => startCheckoutFromSidebar(a)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-blue-50 ring-1 ring-blue-200 hover:ring-blue-300"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-blue-900">{a.firstName}</span>
                        <span className="text-xs text-blue-700">{fmtDuration(mins)}</span>
                      </div>
                    </button>
                  );
                })}
            </>
          )}
        </div>
      </aside>

      {/* MAIN (centered column) */}
      <main className="flex-1 p-6 flex justify-center">
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
          {/* [LANDMARK: greeting banner] */}
          <div className="h-12 w-full flex items-center justify-center">
            {greetName ? (
              <div className="rounded-xl bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 px-4 py-3">
                {(() => {
                  const hr = new Date().getHours();
                  const greeting =
                    hr < 10 ? "Good morning" : hr < 14 ? "Hello" : hr < 18 ? "Good afternoon" : "Good evening";
                  return `${greeting}, ${greetName}.`;
                })()}
              </div>
            ) : (
              <div className="text-gray-600">Ready to scan</div>
            )}
          </div>

          {/* [LANDMARK: conditional center panel] */}
          {!checkoutSession ? (
            <>
              {/* [LANDMARK: checkin keypad panel] */}
              <div className="w-full flex flex-col items-center">
                <div className="w-full max-w-sm text-center">
                  <label className="block text-sm font-medium mb-1 text-left">Enter mobile number</label>
                  <input
                    ref={entryRef}
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitScan();
                    }}
                    inputMode="numeric"
                    placeholder="04xxxxxxxx"
                    className="w-full rounded-lg border px-4 py-3 ring-1 ring-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  />

                  {/* Keypad */}
                  <div className="grid grid-cols-3 gap-3 mt-4 w-64 mx-auto">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "⏎"].map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="rounded-xl ring-1 ring-gray-300 bg-white hover:ring-gray-400 active:scale-[.99] h-16 text-2xl font-medium"
                        onClick={() => {
                          if (k === "⌫") setEntry((s) => s.slice(0, -1));
                          else if (k === "⏎") submitScan();
                          else setEntry((s) => (s + k).slice(0, 12));
                          entryRef.current?.focus();
                        }}
                      >
                        {k}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <button
                      disabled={working || entry.length < 6}
                      onClick={submitScan}
                      className="rounded-xl bg-black text-white px-5 py-3 disabled:opacity-50"
                    >
                      {working ? "Working…" : "Submit"}
                    </button>
                  </div>

                  {/* [LANDMARK: visitor button] */}
                  <div className="mt-6">
                    <a
                      href="/kiosk/visitor"
                      className="inline-block rounded-xl px-5 py-3"
                      style={{ backgroundColor: "#5093eb", color: "white" }}
                    >
                      Visitor check-in
                    </a>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* [LANDMARK: member checkout panel + drill-down category picker] */}
              <div className="w-full max-w-3xl">
                <div className="text-xl font-semibold mb-4 text-center">
                  {checkoutSession.isVisitor ? "Visitor checkout" : "Member checkout"}
                </div>

                {/* Times summary + edit */}
                <div className="rounded-xl ring-1 ring-gray-200 bg-white p-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Checked in</div>
                      <div className="text-lg font-medium">
                        {editStartDate ? `${fmtDate(editStartDate)} ${fmtClock(editStartDate)}` : ""}
                      </div>
                      {canEditTimes() && (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            className="rounded-lg px-3 py-1 ring-1 ring-gray-300"
                            onClick={() => adjustStartDate(-1)}
                          >
                            ◀ Prev day
                          </button>
                          <button
                            className="rounded-lg px-3 py-1 ring-1 ring-gray-300"
                            onClick={() => {
                              if (!editStartDate) return;
                              const d = new Date();
                              const hhmm = startDigits.padStart(4, "0");
                              const todayAt = dateAtTime(d, hhmm);
                              if (todayAt.getTime() > Date.now()) return;
                              setEditStartDate(todayAt);
                            }}
                          >
                            Today
                          </button>
                          <button
                            className="rounded-lg px-3 py-1 ring-1 ring-gray-300"
                            onClick={() => adjustStartDate(+1)}
                          >
                            Next day ▶
                          </button>
                        </div>
                      )}
                      {canEditTimes() && (
                        <div className="mt-3">
                          <div className="text-sm text-gray-600 mb-1">Edit time (HH:MM)</div>
                          <div className="flex items-center gap-2">
                            <div className="text-2xl font-mono w-24 text-center rounded ring-1 ring-gray-300 py-1">
                              {startDigits.padStart(4, "0").slice(0, 2)}:
                              {startDigits.padStart(4, "0").slice(2, 4)}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => (
                                <button
                                  key={`sd-${d}`}
                                  className="rounded px-3 py-2 ring-1 ring-gray-300 bg-white"
                                  onClick={() =>
                                    setStartFromDigits(
                                      pushDigitRightFill(startDigits || "0000", d),
                                      editStartDate
                                    )
                                  }
                                >
                                  {d}
                                </button>
                              ))}
                              <button
                                className="rounded px-3 py-2 ring-1 ring-gray-300 bg-white"
                                onClick={() => setStartFromDigits("0000", editStartDate)}
                              >
                                ⟲
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm text-gray-600 mb-1">Checking out</div>
                      <div className="text-lg font-medium">
                        {editEndDate ? `${fmtDate(editEndDate)} ${fmtClock(editEndDate)}` : ""}
                      </div>
                      {canEditTimes() && (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            className="rounded-lg px-3 py-1 ring-1 ring-gray-300"
                            onClick={() => adjustEndDate(-1)}
                          >
                            ◀ Prev day
                          </button>
                          <button
                            className="rounded-lg px-3 py-1 ring-1 ring-gray-300"
                            onClick={() => {
                              const d = new Date();
                              const hhmm = endDigits.padStart(4, "0");
                              const todayAt = dateAtTime(d, hhmm);
                              if (todayAt.getTime() > Date.now() + 6 * 3600_000) return;
                              setEditEndDate(todayAt);
                            }}
                          >
                            Today
                          </button>
                          <button
                            className="rounded-lg px-3 py-1 ring-1 ring-gray-300"
                            onClick={() => adjustEndDate(+1)}
                          >
                            Next day ▶
                          </button>
                        </div>
                      )}
                      {canEditTimes() && (
                        <div className="mt-3">
                          <div className="text-sm text-gray-600 mb-1">Edit time (HH:MM)</div>
                          <div className="flex items-center gap-2">
                            <div className="text-2xl font-mono w-24 text-center rounded ring-1 ring-gray-300 py-1">
                              {endDigits.padStart(4, "0").slice(0, 2)}:
                              {endDigits.padStart(4, "0").slice(2, 4)}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => (
                                <button
                                  key={`ed-${d}`}
                                  className="rounded px-3 py-2 ring-1 ring-gray-300 bg-white"
                                  onClick={() =>
                                    setEndFromDigits(pushDigitRightFill(endDigits || "0000", d), editEndDate)
                                  }
                                >
                                  {d}
                                </button>
                              ))}
                              <button
                                className="rounded px-3 py-2 ring-1 ring-gray-300 bg-white"
                                onClick={() => setEndFromDigits("0000", editEndDate)}
                              >
                                ⟲
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Duration */}
                  {editStartDate && editEndDate && (
                    <div className="mt-4 text-sm text-gray-700 text-center">
                      Duration:{" "}
                      <span className="font-medium">
                        {fmtDuration(
                          Math.max(1, Math.round((editEndDate.getTime() - editStartDate.getTime()) / 60000))
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* DRILL-DOWN CATEGORY PICKER (replaces top-level with subs, plus Back) */}
                {!checkoutSession.isVisitor && (
                  <div className="rounded-xl ring-1 ring-gray-200 bg-white p-4 mt-4">
                    {/* If no parent selected: show top-level categories */}
                    {!activeParentId ? (
                      <>
                        <div className="text-sm text-gray-700 mb-3 text-center">
                          Choose a category to continue
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {categories.map((c) => (
                            <button
                              key={c.id}
                              className="rounded-xl px-3 py-4 text-center ring-1 ring-gray-300 bg-white hover:ring-gray-400"
                              onClick={() => {
                                setActiveParentId(c.id);
                                setSelectedChildCategoryId(null);
                              }}
                            >
                              <div className="text-xs text-gray-500 mb-1">{c.code}</div>
                              <div className="font-medium">{c.name}</div>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      // Parent selected: show its children grid and a Back button
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <button
                            className="rounded-lg px-3 py-1 ring-1 ring-gray-300 hover:ring-gray-400"
                            onClick={() => {
                              setActiveParentId(null);
                              setSelectedChildCategoryId(null);
                            }}
                          >
                            ← Back
                          </button>
                          <div className="text-sm text-gray-600">
                            {(() => {
                              const p = categories.find((x) => x.id === activeParentId);
                              return p ? `${p.code} — ${p.name}` : "";
                            })()}
                          </div>
                          <div />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {(() => {
                            const p = categories.find((x) => x.id === activeParentId);
                            const kids = p?.children ?? [];
                            return kids.map((ch) => {
                              const selected = selectedChildCategoryId === ch.id;
                              return (
                                <button
                                  key={ch.id}
                                  className={`rounded-xl px-3 py-4 text-center ring-2 ${
                                    selected
                                      ? "ring-blue-500 bg-blue-50"
                                      : "ring-gray-300 bg-white hover:ring-gray-400"
                                  }`}
                                  onClick={() => setSelectedChildCategoryId(ch.id)}
                                >
                                  <div className="text-xs text-gray-500 mb-1">{ch.code}</div>
                                  <div className="font-medium">{ch.name}</div>
                                </button>
                              );
                            });
                          })()}
                        </div>

                        {selectedChildCategoryId && (
                          <div className="mt-3 text-center text-sm text-gray-700">
                            Selected:{" "}
                            <span className="font-medium">
                              {(() => {
                                const p = categories.find((x) => x.id === activeParentId);
                                const ch = p?.children.find((k) => k.id === selectedChildCategoryId);
                                return ch ? `${ch.code} — ${ch.name}` : "";
                              })()}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="flex gap-3 justify-center mt-4">
                  <button
                    className="rounded-xl px-5 py-3 bg-black text-white disabled:opacity-50"
                    disabled={
                      !editStartDate ||
                      !editEndDate ||
                      (!checkoutSession.isVisitor && !selectedChildCategoryId)
                    }
                    onClick={submitCheckout}
                  >
                    Confirm checkout
                  </button>
                  <button
                    className="rounded-xl px-5 py-3 ring-1 ring-gray-300"
                    onClick={() => {
                      setCheckoutSession(null);
                      setActiveParentId(null);
                      setSelectedChildCategoryId(null);
                      setEntry("");
                      entryRef.current?.focus();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
