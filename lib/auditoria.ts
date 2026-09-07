import type { PrismaClient, auditoriaAcao } from "@prisma/client";

// Entidades cobertas pela auditoria.
export type EntidadeAuditada =
  | "ORDEM_SERVICO"
  | "ORCAMENTO"
  | "CAIXA"
  | "CLIENTE"
  | "USUARIO";

export interface RegistroAuditoria {
  usuario: string | null | undefined;
  acao: auditoriaAcao;
  entidade: EntidadeAuditada;
  entidadeId?: string | null;
  descricao?: string | null;
}

// Apenas o delegate usado aqui — aceita tanto o prisma raiz quanto o
// cliente de transação (tx), então o evento cai na mesma transação
// da mutação.
type DbComAuditoria = Pick<PrismaClient, "auditoria">;

// Grava um evento no log de auditoria.
export async function registrarAuditoria(
  db: DbComAuditoria,
  reg: RegistroAuditoria
) {
  await db.auditoria.create({
    data: {
      usuario: reg.usuario ?? null,
      acao: reg.acao,
      entidade: reg.entidade,
      entidadeId: reg.entidadeId ?? null,
      descricao: reg.descricao ? String(reg.descricao).slice(0, 500) : null,
    },
  });
}
