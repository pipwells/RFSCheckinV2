// src/app/kiosk/visitor/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const AGENCY_OPTIONS = [
  'RFS Representative - Sutherland Fire Control Centre',
  'RFS - Group Officer',
  'Council',
  'Contractor',
  'RFSA Representative',
  'Other',
] as const;

const PURPOSE_OPTIONS = ['Meeting Guest', 'Administration', 'Maintenance', 'Interview', 'Other'] as const;

/* Tiny audio helpers */
function isAudioSupported() {
  return (
    typeof window !== 'undefined' &&
    ((window as any).AudioContext || (window as any).webkitAudioContext)
  );
}
function makeCtx(): AudioContext | null {
  if (!isAudioSupported()) return null;
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  return new Ctx();
}
async function beepSuccess() {
  const ctx = makeCtx();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = 880;
  o.connect(g); g.connect(ctx.destination);
  const t = ctx.currentTime; g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.45, t + 0.01);
  o.start(); o.stop(t + 0.18);
}
async function beepError() {
  const ctx = makeCtx();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square'; o.frequency.value = 220;
  o.connect(g); g.connect(ctx.destination);
  const t = ctx.currentTime; g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55, t + 0.01);
  o.start(); o.stop(t + 0.35);
}

export default function VisitorCheckinPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [mobile, setMobile]       = useState('');
  const [agencySel, setAgencySel] = useState<(typeof AGENCY_OPTIONS)[number] | ''>('');
  const [agencyOther, setAgencyOther] = useState('');
  const [purposeSel, setPurposeSel] = useState<(typeof PURPOSE_OPTIONS)[number] | ''>('');
  const [purposeOther, setPurposeOther] = useState('');

  const [err, setErr]   = useState<string>('');
  const [busy, setBusy] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstInputRef.current?.focus(); }, []);

  const finalAgency = agencySel === 'Other' ? agencyOther.trim() : (agencySel || '').trim();
  const finalPurpose = purposeSel === 'Other' ? purposeOther.trim() : (purposeSel || '').trim();

  function validate(): string | null {
    if (!firstName.trim()) return 'Please enter a first name.';
    if (!lastName.trim())  return 'Please enter a last name.';
    if (!mobile.trim())    return 'Please enter a mobile number.';
    if (!finalPurpose)     return 'Please select or enter a purpose.';
    return null;
  }

  async function submit() {
    setErr('');
    const v = validate();
    if (v) {
      setErr(v);
      await beepError();
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/kiosk/visitor/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          mobile: mobile.trim(),
          agency: finalAgency || null,
          purpose: finalPurpose,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.error === 'mobile_belongs_to_member') {
          setErr('This mobile number belongs to a registered member. Please check in using the keypad.');
          await beepError();
          return;
        }
        if (data?.error === 'missing_fields') {
          setErr('Please complete all required fields.');
          await beepError();
          return;
        }
        setErr('Could not check in visitor. Please try again.');
        await beepError();
        return;
      }

      await beepSuccess();
      router.push('/kiosk');
    } catch {
      setErr('Network error. Please try again.');
      await beepError();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl p-6 shadow ring-1 ring-gray-200">
        <h1 className="text-3xl font-semibold mb-2">Visitor check-in</h1>
        <p className="text-gray-600 mb-6">Please enter your details.</p>

        {/* Name + Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">First name</label>
            <input
              ref={firstInputRef}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full p-3 rounded-xl ring-1 ring-gray-300 shadow-sm"
              placeholder="Jane"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Last name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full p-3 rounded-xl ring-1 ring-gray-300 shadow-sm"
              placeholder="Doe"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Mobile</label>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="tel"
              className="w-full p-3 rounded-xl ring-1 ring-gray-300 shadow-sm"
              placeholder="04xxxxxxxx"
            />
          </div>
        </div>

        {/* Agency / Organisation */}
        <div className="mt-6">
          <label className="block text-sm text-gray-600 mb-1">Agency / Organisation</label>
          <div className="flex flex-wrap gap-2">
            {AGENCY_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setAgencySel(opt)}
                className={`px-4 py-2 rounded-xl ring-1 shadow ${
                  agencySel === opt ? 'ring-blue-500' : 'ring-gray-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {agencySel === 'Other' && (
            <input
              value={agencyOther}
              onChange={(e) => setAgencyOther(e.target.value)}
              className="w-full p-3 rounded-xl ring-1 ring-gray-300 shadow-sm mt-2"
              placeholder="Enter agency / organisation"
            />
          )}
        </div>

        {/* Purpose */}
        <div className="mt-6">
          <label className="block text-sm text-gray-600 mb-1">Purpose of visit</label>
          <div className="flex flex-wrap gap-2">
            {PURPOSE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setPurposeSel(opt)}
                className={`px-4 py-2 rounded-xl ring-1 shadow ${
                  purposeSel === opt ? 'ring-blue-500' : 'ring-gray-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {purposeSel === 'Other' && (
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
            style={{ backgroundColor: '#5093eb' }}
          >
            {busy ? 'Checking in…' : 'Confirm visitor check-in'}
          </button>
        </div>
      </div>
    </div>
  );
}
