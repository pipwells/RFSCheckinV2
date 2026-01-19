// src/lib/http.ts
// Small HTTP helpers for JSON responses

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function err(
  status: number,
  message: string,
  extra?: Record<string, unknown>
): Response {
  return Response.json({ error: message, ...(extra || {}) }, { status });
}
