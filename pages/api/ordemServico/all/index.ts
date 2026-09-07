import { requireAuth, emailDoToken } from "../../../../lib/auth";
import { aplicarCors } from "../../../../lib/cors";
import { NextApiRequest, NextApiResponse } from "next";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { criarOSComCaixa } from "../../../../lib/ordemServicoCaixa";
import prisma from '../../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Adiciona os cabeçalhos CORS
  aplicarCors(req, res);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cache-Control"
  );

  // Se for uma requisição OPTIONS (preflight), responde sem processar
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!requireAuth(req, res)) return;

  if (req.method === "GET") {
    try {
      const ordemServicos = await prisma.ordemServico.findMany({
        orderBy: {
          data: "desc", // Ordena pela data do mais recente para o mais antigo
        },
      });

      return res.status(200).json(ordemServicos);
    } catch (error) {
      console.error("Erro ao buscar ordens de serviço:", error);
      return res
        .status(500)
        .json({ error: "Erro ao buscar ordens de serviço" });
    }
  }

  if (req.method === "POST") {
    try {
      const ordensServico = req.body; // Espera que o corpo da requisição seja um array de ordens de serviço

      if (!Array.isArray(ordensServico)) {
        return res
          .status(400)
          .json({ error: "Deve ser um array de ordens de serviço" });
      }

      // Verifica se todos os campos necessários estão presentes nas ordens de serviço
      for (const ordem of ordensServico) {
        if (
          !ordem.cliente ||
          !ordem.preco ||
          !ordem.descricao ||
          !ordem.data ||
          !ordem.maoDeObra ||
          !ordem.material ||
          !ordem.formaDePagamento
        ) {
          return res
            .status(400)
            .json({ error: "Todos os campos são obrigatórios" });
        }
      }

      // Cria as ordens em massa, cada uma com seu lançamento vinculado
      // no caixa (mesmo fluxo do POST simples).
      const usuario = emailDoToken(req);
      const createdOrdensServico = await prisma.$transaction(async (tx) => {
        const criadas = [];
        for (const ordem of ordensServico) {
          criadas.push(
            await criarOSComCaixa(
              tx,
              {
                cliente: ordem.cliente,
                preco: ordem.preco,
                descricao: ordem.descricao,
                data: ordem.data ? new Date(ordem.data) : new Date(),
                maoDeObra: ordem.maoDeObra,
                material: ordem.material,
                formaDePagamento: ordem.formaDePagamento,
              },
              usuario
            )
          );
        }
        await registrarAuditoria(tx, {
          usuario,
          acao: "CRIAR",
          entidade: "ORDEM_SERVICO",
          descricao: `Criação em massa — ${criadas.length} ordens`,
        });
        return criadas;
      });

      return res.status(201).json(createdOrdensServico);
    } catch (error) {
      console.error("Erro ao criar ordens de serviço:", error);
      return res.status(500).json({ error: "Erro ao criar ordens de serviço" });
    }
  }

  res.status(405).json({ error: "Método não permitido" });
}
