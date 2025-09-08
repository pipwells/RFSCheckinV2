// src/lib/http.ts
export const ok = (data: any, init?: ResponseInit) => Response.json(data, init);
export const bad = (msg: string, code = 400) => Response.json({ error: msg }, { status: code });
