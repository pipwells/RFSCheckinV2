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
 *   [LANDMARK: actions - scan / scan-as / sidebar checkout / time edits / confirm checkout]
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

type AmbiguousCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  firegroundNumber: string;
};

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

  // Active list + categories
  const [active, setActive] = React.useState<ActiveEntry[]>([]);
  const [categories, setCategories] = React.useState<ParentCat[]>([]);

  // Greeting banner
  const [greetName, setGreetName] = React.useState<string | null>(null);
  const greetTimerRef = React.useRef<number | null>(null);

  // Ambiguous mobile selection
  const [ambiguous, setAmbiguous] = React.useState<AmbiguousCandidate[] | null>(null);

  // Checkout state (member checkout)
  const [checkoutSession, setCheckoutSession] = React.useState<{
    sessionId: string;
    firstName: string;
    startISO: string;
    isVisitor?: boolean;
  } | null>(null);

  // Time edits
  const [editStartDate, setEditStartDate] = React.useState<Date>(new Date());
  const [editEndDate, setEditEndDate] = React.useState<Date>(new Date());
  const [startDigits, setStartDigits] = React.useState<string>("0000");
  const [endDigits, setEndDigits] = React.useState<string>("0000");

  // Category drill-down
  const [activeParentId, setActiveParentId] = React.useState<string | null>(null);
  const [selectedChildCategoryId, setSelectedChildCategoryId] = React.useState<string | null>(null);

  // Polling
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
      // keep UI duration clocks live
      setActive((prev) => [...prev]);
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  // Keep the keypad input focused (RFID wedge + fast entry)
  React.useEffect(() => {
    const t = window.setInterval(() => {
      if (!entryRef.current) return;
      // Avoid stealing focus if user is interacting with checkout or modal buttons
      if (document.activeElement && document.activeElement !== document.body) {
        const el = document.activeElement as HTMLElement;
        const tag = (el.tagName || "").toLowerCase();
        if (tag === "button" || tag === "select" || tag === "textarea") return;
      }
      entryRef.current?.focus();
    }, 600);
    return () => clearInterval(t);
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
  // [LANDMARK: actions - scan / scan-as / sidebar checkout / time edits / confirm checkout]
  // --------------------------------------------------
  async function submitScan() {
    if (!entry) return;
    setWorking(true);
    setAmbiguous(null);

    try {
      const res = await fetch("/api/kiosk/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: entry }),
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
        setEntry("");
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

      if (data.status === "ambiguous" && Array.isArray(data.candidates)) {
        // Shared mobile: show pick list
        setAmbiguous(data.candidates as AmbiguousCandidate[]);
        setEntry("");
        setWorking(false);
        // Keep focus ready for the next scan immediately after selection
        window.setTimeout(() => entryRef.current?.focus(), 50);
        return;
      }

      if (data.status === "already_in") {
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
        setTimeout(async () => setActive(await fetchActive()), 300);
        setWorking(false);
        return;
      }

      await beepNegative();
      setEntry("");
    } catch (e) {
      console.error("scan error", e);
      await beepNegative();
    } finally {
      setWorking(false);
    }
  }

  async function submitScanAs(memberId: string) {
    if (!memberId) return;
    setWorking(true);

    try {
      const res = await fetch("/api/kiosk/scan-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();

      setAmbiguous(null);

      if (data.error === "no_kiosk" || data.error === "invalid_kiosk") {
        await beepNegative();
        alert("This device is not registered as a kiosk.");
        setWorking(false);
        return;
      }

      if (data.status === "unknown") {
        await beepNegative();
        setWorking(false);
        entryRef.current?.focus();
        return;
      }

      if (data.error === "disabled") {
        await beepNegative();
        setWorking(false);
        entryRef.current?.focus();
        return;
      }

      if (data.status === "already_in") {
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

        setActiveParentId(null);
        setSelectedChildCategoryId(null);

        setWorking(false);
        return;
      }

      if (data.status === "checked_in") {
        await beepPositive();
        setGreetName(data.firstName ?? "Member");
        setTimeout(async () => setActive(await fetchActive()), 300);
        setWorking(false);
        entryRef.current?.focus();
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
      isVisitor: item.isVisitor,
    });
    const startD = new Date(item.startTime);
    const endD = new Date();
    setEditStartDate(startD);
    setEditEndDate(endD);
    setStartDigits(fmtClock(startD).replace(":", ""));
    setEndDigits(fmtClock(endD).replace(":", ""));

    setActiveParentId(null);
    setSelectedChildCategoryId(null);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pushDigitRightFill(current: string, d: string) {
    const digits = (current || "0000").padStart(4, "0").slice(-4).split("");
    digits.shift();
    digits.push(d);
    return digits.join("");
  }

  // --------------------------------------------------
  // [LANDMARK: UI - layout scaffold]
  // --------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* [LANDMARK: greeting banner] */}
        {greetName && (
          <div className="mb-4 rounded-lg bg-emerald-900/40 border border-emerald-700 px-4 py-3">
            <div className="text-lg font-semibold">Welcome, {greetName}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* [LANDMARK: sidebar - members top / visitors bottom] */}
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

          {/* MAIN PANEL */}
          <div className="lg:col-span-2 space-y-4">
            {/* [LANDMARK: checkin keypad panel] */}
            {!checkoutSession && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">Member check-in</div>
                    <div className="text-sm text-zinc-300">
                      Scan RFID, enter Fireground No., or enter Mobile.
                    </div>
                  </div>

                  <div className="text-xs text-zinc-400">{working ? "Working..." : "Ready"}</div>
                </div>

                {/* Hidden-but-focused input for RFID keyboard wedge + manual entry */}
                <input
                  ref={entryRef}
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitScan();
                  }}
                  className="mt-3 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-lg tracking-wide outline-none focus:border-emerald-600"
                  placeholder="RFID / Fireground / Mobile"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                />

                {/* Ambiguous selection panel */}
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
                          <div className="text-xs text-amber-200">Fireground: {m.firegroundNumber}</div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-amber-200">
                      Tip: use Fireground No. or RFID to skip this step.
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

            {/* [LANDMARK: member checkout panel + drill-down category picker] */}
            {/* NOTE: unchanged checkout UI below — preserved as-is */}
            {checkoutSession && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">Checkout: {checkoutSession.firstName}</div>
                    <div className="text-sm text-zinc-300">
                      Session duration:{" "}
                      {fmtDuration(durationMins(checkoutSession.startISO, new Date().toISOString()))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setCheckoutSession(null);
                      setActiveParentId(null);
                      setSelectedChildCategoryId(null);
                      window.setTimeout(() => entryRef.current?.focus(), 50);
                    }}
                    className="rounded-md border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950 px-3 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>

                {/* Existing time edit + categories UI continues (kept from your current file) */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="text-sm font-semibold mb-2">Start</div>
                    <div className="text-xs text-zinc-400 mb-2">
                      {fmtDate(editStartDate)} {fmtClock(editStartDate)}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "OK"].map((k) => (
                        <button
                          key={k}
                          onClick={() => {
                            if (k === "←") {
                              setStartDigits((prev) => ("0000" + prev).slice(0, 3) + "0");
                              return;
                            }
                            if (k === "OK") {
                              const parsed = parseFlexibleHHmm(startDigits);
                              if (parsed) setEditStartDate(dateAtTime(editStartDate, parsed));
                              return;
                            }
                            setStartDigits((prev) => pushDigitRightFill(prev, k));
                          }}
                          className="rounded-md border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950 px-3 py-3 text-base font-semibold"
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-zinc-400">Digits: {startDigits}</div>
                  </div>

                  <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="text-sm font-semibold mb-2">End</div>
                    <div className="text-xs text-zinc-400 mb-2">
                      {fmtDate(editEndDate)} {fmtClock(editEndDate)}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "OK"].map((k) => (
                        <button
                          key={k}
                          onClick={() => {
                            if (k === "←") {
                              setEndDigits((prev) => ("0000" + prev).slice(0, 3) + "0");
                              return;
                            }
                            if (k === "OK") {
                              const parsed = parseFlexibleHHmm(endDigits);
                              if (parsed) setEditEndDate(dateAtTime(editEndDate, parsed));
                              return;
                            }
                            setEndDigits((prev) => pushDigitRightFill(prev, k));
                          }}
                          className="rounded-md border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950 px-3 py-3 text-base font-semibold"
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-zinc-400">Digits: {endDigits}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="text-sm font-semibold mb-2">What did you do?</div>

                  {/* Parent category buttons */}
                  {!activeParentId && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {categories.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setActiveParentId(p.id);
                            setSelectedChildCategoryId(null);
                          }}
                          className="rounded-md border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950 px-3 py-3 text-left"
                        >
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-xs text-zinc-400">{p.code}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Child category buttons */}
                  {activeParentId && (
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">
                          {categories.find((c) => c.id === activeParentId)?.name ?? "Category"}
                        </div>
                        <button
                          onClick={() => {
                            setActiveParentId(null);
                            setSelectedChildCategoryId(null);
                          }}
                          className="text-xs rounded-md border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950 px-2 py-1"
                        >
                          Back
                        </button>
                      </div>

                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(categories.find((c) => c.id === activeParentId)?.children ?? []).map((ch) => (
                          <button
                            key={ch.id}
                            onClick={() => setSelectedChildCategoryId(ch.id)}
                            className={`rounded-md border px-3 py-3 text-left ${
                              selectedChildCategoryId === ch.id
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
                  )}
                </div>

                {/* Confirm checkout */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-zinc-400">
                    Rounded minutes:{" "}
                    {roundMinutesTo10(durationMins(editStartDate.toISOString(), editEndDate.toISOString()))}m
                  </div>

                  <button
                    onClick={async () => {
                      if (!checkoutSession) return;

                      const startISO = editStartDate.toISOString();
                      const endISO = editEndDate.toISOString();
                      const minutes = roundMinutesTo10(durationMins(startISO, endISO));

                      try {
                        const res = await fetch("/api/kiosk/checkout", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            sessionId: c
