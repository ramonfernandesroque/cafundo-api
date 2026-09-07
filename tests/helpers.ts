// Helpers para testar os handlers (pages/api) sem subir o servidor:
// req/res mínimos + JWT de teste + limpeza de registros VITEST.
import "dotenv/config";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

export const TAG = "VITEST";

export const mockReq = (opts: {
  method?: string;
  query?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
  token?: string | null;
  role?: "ADMIN" | "OPERADOR";
  email?: string;
  headers?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any => {
  let auth: Record<string, string> = {};
  if (opts.token !== null) {
    const secret = process.env.SECRET_KEY as string;
    const t =
      opts.token ??
      jwt.sign(
        { userId: "vitest", email: opts.email ?? "vitest@teste.com", role: opts.role ?? "ADMIN" },
        secret,
        { expiresIn: "10m" }
      );
    auth = { authorization: `Bearer ${t}` };
  }
  return {
    method: opts.method ?? "GET",
    query: opts.query ?? {},
    body: opts.body,
    headers: { ...auth, ...(opts.headers ?? {}) },
  };
};

export interface Captured {
  statusCode: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mockRes = (): any => {
  const captured: Captured = { statusCode: 200, payload: undefined };
  const res = {
    captured,
    setHeader: () => undefined,
    status: (code: number) => {
      captured.statusCode = code;
      return res;
    },
    json: (p: unknown) => {
      captured.payload = p;
      return res;
    },
    end: (p?: unknown) => {
      captured.payload = p;
      return res;
    },
  };
  return res;
};

// Apaga registros de teste (rastreados por ids) + auditoria vinculada.
export async function limpar(ids: {
  os?: string[];
  orc?: string[];
  caixa?: string[];
  users?: string[];
}) {
  const { os = [], orc = [], caixa = [], users = [] } = ids;
  if (caixa.length) await prisma.transacoesCaixa.deleteMany({ where: { id: { in: caixa } } });
  if (os.length) {
    await prisma.transacoesCaixa.deleteMany({ where: { ordemServicoId: { in: os } } });
    await prisma.ordemServico.deleteMany({ where: { id: { in: os } } });
  }
  if (orc.length) await prisma.orcamento.deleteMany({ where: { id: { in: orc } } });
  if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
  const todos = [...os, ...orc, ...caixa, ...users];
  if (todos.length) {
    await prisma.auditoria.deleteMany({ where: { entidadeId: { in: todos } } });
  }
}

// Apaga eventos de auditoria gerados pelos testes.
export async function limparAuditoriaVitest() {
  await prisma.auditoria.deleteMany({ where: { usuario: "vitest@teste.com" } });
}

export { prisma };
