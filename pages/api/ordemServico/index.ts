import { requireAuth } from "../../../lib/auth";
import { aplicarCors } from "../../../lib/cors";
import { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../lib/prisma';
import { criarOSComCaixa } from "../../../lib/ordemServicoCaixa";
import { emailDoToken } from "../../../lib/auth";
import { registrarAuditoria } from "../../../lib/auditoria";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Adiciona os cabeçalhos CORS
  aplicarCors(req, res);
  // res.setHeader(
  //   "https://swiss-wp-coral-blast.trycloudflare.com"
  // ); // Substitua pela URL real do seu front-end

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
    } catch {
      return res
        .status(500)
        .json({ error: "Erro ao buscar ordens de serviço" });
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
      } = req.body;

      // Cria a ordem de serviço e o lançamento correspondente no caixa
      // (ENTRADA / SERVICOS) já vinculado via ordemServicoId, dentro da
      // mesma transação: ou ambos persistem, ou nenhum. Registra autoria
      // e auditoria junto.
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

      return res.status(201).json(ordemServico);
    } catch (e) {
      console.error("Erro ao criar ordem de serviço:", e);
      return res.status(500).json({
        error: "Erro ao criar ordem de serviço",
        details:
          process.env.NODE_ENV !== "production"
            ? String((e as Error)?.message ?? e)
            : undefined,
      });
    }
  }

  res.status(405).json({ error: "Método não permitido" });
}
