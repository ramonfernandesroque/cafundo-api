import { requireAuth } from "../../../lib/auth";
import { aplicarCors } from "../../../lib/cors";
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";
import { criarOSComCaixa, dinheiro } from "../../../lib/ordemServicoCaixa";
import { emailDoToken } from "../../../lib/auth";
import { registrarAuditoria } from "../../../lib/auditoria";

// POST /api/orcamento/convert  body: { id: string }
// Converte um orçamento PENDENTE em ordem de serviço:
// cria a OS + lança no caixa (ENTRADA/SERVICOS, vinculado via
// ordemServicoId) e marca o orçamento APROVADO.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  aplicarCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "Informe o id do orçamento" });

    const orcamento = await prisma.orcamento.findUnique({
      where: { id: String(id) },
    });
    if (!orcamento) {
      return res.status(404).json({ error: "Orçamento não encontrado" });
    }
    if (orcamento.status === "APROVADO") {
      return res.status(400).json({ error: "Orçamento já convertido" });
    }
    if (orcamento.status === "RECUSADO") {
      return res.status(400).json({ error: "Orçamento recusado não pode virar OS" });
    }

    // Validade expirada -> marca EXPIRADO e bloqueia a conversão
    if (orcamento.validade) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const val = new Date(orcamento.validade);
      val.setHours(0, 0, 0, 0);
      if (val < hoje) {
        await prisma.orcamento.update({
          where: { id: orcamento.id },
          data: { status: "EXPIRADO" },
        });
        return res.status(400).json({ error: "Orçamento com validade expirada" });
      }
    }

    const { ordemServico, atualizado } = await prisma.$transaction(
      async (tx) => {
        const usuario = emailDoToken(req);
        const ordemServico = await criarOSComCaixa(
          tx,
          {
            cliente: orcamento.cliente,
            preco: dinheiro(orcamento.preco),
            descricao: orcamento.descricao,
            data: new Date(),
            maoDeObra: dinheiro(orcamento.maoDeObra),
            material: dinheiro(orcamento.material),
            formaDePagamento: orcamento.formaDePagamento,
          },
          usuario
        );

        const atualizado = await tx.orcamento.update({
          where: { id: orcamento.id },
          data: {
            status: "APROVADO",
            ordemServicoId: ordemServico.id,
            atualizadoPor: usuario,
          },
        });

        await registrarAuditoria(tx, {
          usuario,
          acao: "CONVERTER",
          entidade: "ORCAMENTO",
          entidadeId: orcamento.id,
          descricao: `${orcamento.cliente} — virou OS ${ordemServico.id}`,
        });

        return { ordemServico, atualizado };
      }
    );

    return res.status(201).json({ orcamento: atualizado, ordemServico });
  } catch (error) {
    console.error("Erro ao converter orçamento:", error);
    return res.status(500).json({
      error: "Erro ao converter orçamento em OS",
      details:
        process.env.NODE_ENV !== "production"
          ? String((error as Error)?.message ?? error)
          : undefined,
    });
  }
}
