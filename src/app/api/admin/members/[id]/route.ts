// src/app/api/admin/members/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { normaliseAUMobile } from "@/lib/mobile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

function isForm(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  return ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");
}

function redirect303(req: NextRequest, to: string) {
  return NextResponse.redirect(new URL(to, req.url), 303);
}

async function requireOrgId() {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return { orgId: null as string | null, unauth: true };
  return { orgId, unauth: false };
}

async function readBody(req: NextRequest): Promise<{
  methodOverride?: string;
  redirectTo?: string;
  data: Record<string, unknown>;
}> {
  if (isForm(req)) {
    const form = await req.formData().catch(() => undefined);
    const data: Record<string, unknown> = {};
    if (form) {
      for (const [k, v] of form.entries()) data[k] = v;
    }
    const methodOverride = String(data._method || "").trim().toUpperCase() || undefined;
    const redirectTo = String(data.redirect || "").trim() || undefined;
    return { methodOverride, redirectTo, data };
  }

  const json = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const methodOverride = String((json as any)?._method || "").trim().toUpperCase() || undefined;
  const redirectTo = String((json as any)?.redirect || "").trim() || undefined;
  return { methodOverride, redirectTo, data: json || {} };
}

function pickString(data: Record<string, unknown>, key: string): string | undefined {
  const v = data[key];
  if (typeof v === "string") return v.trim();
  if (v instanceof File) return undefined;
  if (v == null) return undefined;
  return String(v).trim();
}

export async function GET(_req: NextRequest, context: { params: Promise<Params> }) {
  const { id } = await context.params;

  const { orgId, unauth } = await requireOrgId();
  if (unauth || !orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const m = await prisma.member.findFirst({
    where: { id, organisationId: orgId, isVisitor: false },
    select: {
      id: true,
      firegroundNumber: true,
      firstName: true,
      lastName: true,
      mobile: true,
      mobileNormalized: true,
      status: true,
      isVisitor: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, member: m }, { status: 200 });
}

export async function POST(req: NextRequest, context: { params: Promise<Params> }) {
  const { id } = await context.params;

  const { orgId, unauth } = await requireOrgId();
  if (unauth || !orgId) {
    // For form posts, behave like the rest of admin auth: redirect to login.
    if (isForm(req)) return redirect303(req, "/admin/login");
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const { methodOverride, redirectTo, data } = await readBody(req);
  const effective = methodOverride || "POST";

  // Method override handler for admin forms.
  if (effective === "PATCH" || effective === "PUT") {
    const firstName = pickString(data, "firstName");
    const lastName = pickString(data, "lastName");
    const mobile = pickString(data, "mobile");
    const status = pickString(data, "status");
    const firegroundNumber = pickString(data, "firegroundNumber");

    const update: Record<string, unknown> = {};

    if (typeof firstName === "string" && firstName.length > 0) update.firstName = firstName;
    if (typeof lastName === "string" && lastName.length > 0) update.lastName = lastName;

    if (typeof firegroundNumber === "string" && firegroundNumber.length > 0) {
      update.firegroundNumber = firegroundNumber;
    }

    if (typeof status === "string" && status.length > 0) {
      update.status = status;
    }

    if (typeof mobile === "string") {
      const trimmed = mobile.trim();
      if (!trimmed) {
        update.mobile = null;
        update.mobileNormalized = null;
      } else {
        const n = normaliseAUMobile(trimmed);
        if (!n) {
          if (redirectTo) return redirect303(req, `${redirectTo}?error=mobile_invalid`);
          return NextResponse.json({ error: "mobile_invalid" }, { status: 400 });
        }
        update.mobile = trimmed;
        update.mobileNormalized = n;
      }
    }

    if (Object.keys(update).length === 0) {
      if (redirectTo) return redirect303(req, redirectTo);
      return NextResponse.json({ ok: true, id, updated: false }, { status: 200 });
    }

    try {
      const updated = await prisma.member.update({
        where: { id },
        data: update,
        select: { id: true },
      });

      // Enforce org + non-visitor scope (Prisma update(where:{id}) can’t include org in where)
      const scoped = await prisma.member.findFirst({
        where: { id: updated.id, organisationId: orgId, isVisitor: false },
        select: { id: true },
      });

      if (!scoped) {
        // Revert? simplest: block and report. (This should not happen if IDs are not guessable.)
        if (redirectTo) return redirect303(req, `${redirectTo}?error=unauthorised`);
        return NextResponse.json({ error: "unauthorised" }, { status: 401 });
      }

      if (redirectTo) return redirect303(req, redirectTo);
      return NextResponse.json({ ok: true, id: updated.id }, { status: 200 });
    } catch (e: any) {
      if (e?.code === "P2002") {
        if (redirectTo) return redirect303(req, `${redirectTo}?error=duplicate`);
        return NextResponse.json({ error: "duplicate" }, { status: 409 });
      }
      if (redirectTo) return redirect303(req, `${redirectTo}?error=failed`);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
  }

  if (effective === "DELETE") {
    try {
      const m = await prisma.member.findFirst({
        where: { id, organisationId: orgId, isVisitor: false },
        select: { id: true },
      });
      if (!m) {
        if (redirectTo) return redirect303(req, redirectTo);
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      await prisma.member.delete({ where: { id: m.id } });

      if (redirectTo) return redirect303(req, redirectTo);
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (e: any) {
      if (redirectTo) return redirect303(req, `${redirectTo}?error=delete_failed`);
      return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }
  }

  // If someone posts without _method, treat as “not supported” for this endpoint.
  if (redirectTo) return redirect303(req, `${redirectTo}?error=method_not_allowed`);
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}

export async function PATCH(req: NextRequest, context: { params: Promise<Params> }) {
  // JSON clients can use PATCH directly
  const { id } = await context.params;

  const { orgId, unauth } = await requireOrgId();
  if (unauth || !orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Reuse POST override logic by faking _method=PATCH
  (body as any)._method = "PATCH";

  const fakeReq = new NextRequest(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify(body),
  });

  return POST(fakeReq, { params: Promise.resolve({ id }) });
}

export async function DELETE(req: NextRequest, context: { params: Promise<Params> }) {
  // JSON clients can use DELETE directly
  const { id } = await context.params;

  const { orgId, unauth } = await requireOrgId();
  if (unauth || !orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const body: Record<string, unknown> = { _method: "DELETE" };
  const fakeReq = new NextRequest(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify(body),
  });

  return POST(fakeReq, { params: Promise.resolve({ id }) });
}
