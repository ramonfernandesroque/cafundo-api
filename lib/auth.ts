import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";

// Guarda de autenticação/autorização para as rotas da API.
// O front-end envia o token obtido em /api/login-jwt no header:
//   Authorization: Bearer <token>
//
// Uso nas rotas:
//   import { requireAdmin } from '../../../lib/auth';
//   ...
//   if (req.method === "OPTIONS") return res.status(200).end();
//   if (!requireAdmin(req, res)) return; // 401 sem token, 403 sem permissão
//   ...lógica da rota...

export type AuthRole = "ADMIN" | "OPERADOR";

export interface AuthPayload {
  userId: string;
  email: string;
  role: AuthRole;
  iat: number;
  exp: number;
}

// Valida o JWT e (opcionalmente) a role. Responde 401/403 e retorna
// null quando o acesso deve ser negado; caso contrário retorna o payload.
export function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  allowedRoles: AuthRole[] = ["ADMIN", "OPERADOR"]
): AuthPayload | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de autenticação ausente." });
    return null;
  }

  const secret = process.env.SECRET_KEY;
  if (!secret) {
    console.error("SECRET_KEY não configurada");
    res.status(500).json({ error: "Erro interno no servidor" });
    return null;
  }

  try {
    const payload = jwt.verify(header.slice(7), secret) as AuthPayload;
    if (!payload?.role || !allowedRoles.includes(payload.role)) {
      res.status(403).json({ error: "Acesso negado para este perfil." });
      return null;
    }
    return payload;
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado." });
    return null;
  }
}

// Atalho para rotas exclusivas do ADMIN (caixa, relatórios).
export function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): AuthPayload | null {
  return requireAuth(req, res, ["ADMIN"]);
}

// Auth opcional: extrai o email do usuário logado a partir do JWT,
// sem bloquear a requisição. Usado para registrar autoria (criadoPor /
// atualizadoPor) e auditoria nas rotas operacionais (OS, orçamento).
// Retorna null quando não há token ou ele é inválido.
export function emailDoToken(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const secret = process.env.SECRET_KEY;
  if (!secret) return null;
  try {
    const payload = jwt.verify(header.slice(7), secret) as AuthPayload;
    return payload?.email ?? null;
  } catch {
    return null;
  }
}
