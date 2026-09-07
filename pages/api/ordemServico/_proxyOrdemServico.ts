import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";
import { requireAuth, emailDoToken } from "../../../lib/auth";
import { aplicarCors } from "../../../lib/cors";
import { registrarAuditoria } from "../../../lib/auditoria";
import { criarOSComCaixa } from "../../../lib/ordemServicoCaixa";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  aplicarCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!requireAuth(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método não permitido" });
  }

  try {
    // Mesmo fluxo do POST simples: cria com lançamento vinculado no caixa.
    const {
      cliente,
      preco,
      descricao,
      data,
      maoDeObra,
      material,
      formaDePagamento,
    } = req.body;

    const usuario = emailDoToken(req);
    const ordemServico = await prisma.$transaction(async (tx) => {
      const os = await criarOSComCaixa(
        tx,
        {
          cliente,
          preco,
          descricao,
          data: data ? new Date(data) : new Date(),
          maoDeObra,
          material,
          formaDePagamento,
        },
        usuario
      );
      await registrarAuditoria(tx, {
        usuario,
        acao: "CRIAR",
        entidade: "ORDEM_SERVICO",
        entidadeId: os.id,
        descricao: `${os.cliente} — ${os.descricao}`,
      });
      return os;
    });

    return res.status(200).json(ordemServico);
  } catch (error) {
    console.error("Erro ao criar ordem de serviço via proxy:", error);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
}
