import { requireAuth } from "../../../lib/auth";
import { aplicarCors } from "../../../lib/cors";
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";
import { emailDoToken } from "../../../lib/auth";
import { registrarAuditoria } from "../../../lib/auditoria";
import { dinheiro } from "../../../lib/ordemServicoCaixa";

const cors = (req: NextApiRequest, res: NextApiResponse) => {
  aplicarCors(req, res);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cache-Control"
  );
};

// Orçamento NÃO movimenta o caixa na criação — só quando convertido em OS.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAuth(req, res)) return;

  if (req.method === "GET") {
    try {
      const orcamentos = await prisma.orcamento.findMany({
        orderBy: { data: "desc" },
      });
      return res.status(200).json(orcamentos);
    } catch {
      return res.status(500).json({ error: "Erro ao buscar orçamentos" });
    }
  }

  if (req.method === "POST") {
    try {
      const {
        cliente,
        preco,
        descricao,
        data,
        maoDeObra,
        material,
        formaDePagamento,
        validade,
        status,
      } = req.body;

      const usuario = emailDoToken(req);

      const orcamento = await prisma.$transaction(async (tx) => {
        const criado = await tx.orcamento.create({
          data: {
            cliente,
            preco: dinheiro(preco),
            descricao,
            data,
            maoDeObra: dinheiro(maoDeObra),
            material: dinheiro(material),
            formaDePagamento,
            validade: validade ? new Date(validade) : undefined,
            status: status ?? "PENDENTE",
            criadoPor: usuario,
            atualizadoPor: usuario,
          },
        });
        await registrarAuditoria(tx, {
          usuario,
          acao: "CRIAR",
          entidade: "ORCAMENTO",
          entidadeId: criado.id,
          descricao: `${criado.cliente} — ${criado.descricao}`,
        });
        return criado;
      });

      return res.status(201).json(orcamento);
    } catch (e) {
      console.error("Erro ao criar orçamento:", e);
      return res.status(500).json({
        error: "Erro ao criar orçamento",
        details:
          process.env.NODE_ENV !== "production"
            ? String((e as Error)?.message ?? e)
            : undefined,
      });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
