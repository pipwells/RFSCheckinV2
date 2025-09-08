import { Prisma } from '@prisma/client';

function digitsOnly(s: string) { return String(s || '').replace(/\D/g, ''); }
export function normalizeAUMobile(s?: string | null) {
  const d = digitsOnly(s || '');
  if (!d) return null;
  if (d.startsWith('61') && d.length >= 11) return ('0' + d.slice(2)) as string;
  if (d.length === 9 && !d.startsWith('0')) return ('0' + d) as string;
  return d as string;
}

export const mobileNormalizeMiddleware: Prisma.Middleware = async (params, next) => {
  if (params.model === 'Member' && (params.action === 'create' || params.action === 'update' || params.action === 'upsert')) {
    const data = params.args?.data;
    if (data && ('mobile' in data || 'mobileNormalized' in data)) {
      const raw = data.mobile ?? (typeof data.mobileNormalized === 'string' ? data.mobileNormalized : undefined);
      data.mobileNormalized = normalizeAUMobile(raw);
    }
  }
  return next(params);
};
