import type { NextApiRequest, NextApiResponse } from "next";

// CORS restrito: reflete a Origin somente se estiver na allowlist.
// Sem Origin (curl, server-to-server, testes): não define o header
// (CORS só afeta navegadores).
// Extras via env CORS_ORIGINS (separados por vírgula).
// Túneis *.trycloudflare.com são aceitos (host temporário de demo).
const PADRAO = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://192.168.15.2:8080",
  "http://192.168.15.109:8080",
];

export function origemPermitida(origin: string | null): string | null {
  if (!origin) return null;
  const extras = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if ([...PADRAO, ...extras].includes(origin)) return origin;
  try {
    const host = new URL(origin).hostname;
    if (host.endsWith(".trycloudflare.com")) return origin;
  } catch {
    return null;
  }
  return null;
}

export function aplicarCors(req: NextApiRequest, res: NextApiResponse) {
  const permitida = origemPermitida(req.headers.origin ?? null);
  if (permitida) res.setHeader("Access-Control-Allow-Origin", permitida);
  res.setHeader("Vary", "Origin");
}
