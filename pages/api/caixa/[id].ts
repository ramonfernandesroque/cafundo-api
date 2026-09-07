import { aplicarCors } from "../../../lib/cors";
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../lib/prisma';
import { requireAdmin, emailDoToken } from '../../../lib/auth';
import { registrarAuditoria } from '../../../lib/auditoria';
import { dinheiro } from '../../../lib/ordemServicoCaixa';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  aplicarCors(req, res);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Access-Control-Allow-Headers, cache-control"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Rota exclusiva do ADMIN (caixa). Sem token -> 401, sem permissão -> 403.
  if (!requireAdmin(req, res)) return;

  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const transacao = await prisma.transacoesCaixa.findUnique({
        where: { id: String(id) },
      });

      if (!transacao) {
        return res.status(404).json({ error: "Transação não encontrada" });
      }

      return res.json(transacao);
    } catch (error) {
      console.error("Erro ao buscar transação:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }

  if (req.method === "PUT") {
    try {
      const { data, descricao, categorias, tipo, valor } = req.body;

      console.log("Dados recebidos:", {
        data,
        descricao,
        categorias,
        tipo,
        valor,
      });

      // Lançamento com origem em ordem de serviço é somente-leitura no
      // caixa: gerencie pela tela de OS (a edição lá reflete aqui).
      const atual = await prisma.transacoesCaixa.findUnique({
        where: { id: String(id) },
      });
      if (!atual) {
        return res.status(404).json({ error: "Transação não encontrada" });
      }
      if (atual.ordemServicoId) {
        return res.status(409).json({
          error:
            "Lançamento vinculado a uma ordem de serviço — edite pela tela de ordens de serviço.",
        });
      }

      const transacao = await prisma.$transaction(async (tx) => {
        const atualizada = await tx.transacoesCaixa.update({
          where: { id: String(id) },
          data: {
            data: new Date(data),
            descricao,
            categorias,
            tipo,
            valor: dinheiro(valor),
            atualizadoPor: emailDoToken(req),
          },
        });
        await registrarAuditoria(tx, {
          usuario: emailDoToken(req),
          acao: "ATUALIZAR",
          entidade: "CAIXA",
          entidadeId: String(id),
          descricao: `${descricao} — ${valor}`,
        });
        return atualizada;
      });

      console.log("Transação atualizada:", transacao);
      return res.json(transacao);
    } catch (error) {
      console.error("Erro ao atualizar transação:", error);
      return res.status(500).json({ error: "Erro ao atualizar a transação" });
    }
  }

  if (req.method === "DELETE") {
    try {
      // Lançamento com origem em ordem de serviço não pode ser excluído
      // pelo caixa: exclua a ordem de serviço (o lançamento sai junto).
      const atual = await prisma.transacoesCaixa.findUnique({
        where: { id: String(id) },
      });
      if (!atual) {
        return res.status(404).json({ error: "Transação não encontrada" });
      }
      if (atual.ordemServicoId) {
        return res.status(409).json({
          error:
            "Lançamento vinculado a uma ordem de serviço — exclua a ordem de serviço.",
        });
      }

      const transacao = await prisma.$transaction(async (tx) => {
        const excluida = await tx.transacoesCaixa.delete({
          where: { id: String(id) },
        });
        await registrarAuditoria(tx, {
          usuario: emailDoToken(req),
          acao: "EXCLUIR",
          entidade: "CAIXA",
          entidadeId: String(id),
          descricao: `${excluida.descricao} — ${excluida.valor}`,
        });
        return excluida;
      });

      return res.json(transacao);
    } catch (error) {
      console.error("Erro ao deletar transação:", error);
      return res.status(500).json({ error: "Erro ao deletar a transação" });
    }
  }

  res.status(405).end(); // Método não permitido
}
