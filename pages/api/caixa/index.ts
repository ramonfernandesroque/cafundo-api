import { aplicarCors } from "../../../lib/cors";
import type { NextApiRequest, NextApiResponse } from "next";
import { tiposDeCategorias, TipoTransacao } from '@prisma/client';
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Rota exclusiva do ADMIN (caixa). Sem token -> 401, sem permissão -> 403.
  if (!requireAdmin(req, res)) return;

  if (req.method === "GET") {
    try {
      const transacoes = await prisma.transacoesCaixa.findMany();
      if (transacoes.length === 0) {
        return res
          .status(404)
          .json({ message: "Nenhuma transação encontrada" });
      }
      return res.status(200).json(transacoes);
    } catch (error) {
      return res.status(500).json({
        error: "Erro ao buscar transações do caixa",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (req.method === "POST") {
    const { data, descricao, categorias, tipo, valor } = req.body;

    // Validação dos campos obrigatórios
    if (!data || !descricao || !categorias || !tipo || !valor) {
      return res.status(400).json({
        error: "Campos obrigatórios: data, descricao, categorias, tipo, valor",
      });
    }

    // Validação do enum categorias
    if (!Object.values(tiposDeCategorias).includes(categorias)) {
      return res.status(400).json({ error: "Categoria inválida" });
    }

    // Validação do enum tipo
    if (!Object.values(TipoTransacao).includes(tipo)) {
      return res.status(400).json({ error: "Tipo de transação inválido" });
    }

    try {
      const usuario = emailDoToken(req);
      const novaTransacao = await prisma.$transaction(async (tx) => {
        const criada = await tx.transacoesCaixa.create({
          data: {
            data: new Date(data),
            descricao,
            categorias,
            tipo,
            valor: dinheiro(valor),
            criadoPor: usuario,
            atualizadoPor: usuario,
          },
        });
        await registrarAuditoria(tx, {
          usuario,
          acao: "CRIAR",
          entidade: "CAIXA",
          entidadeId: criada.id,
          descricao: `${descricao} — ${valor}`,
        });
        return criada;
      });

      return res.status(201).json(novaTransacao);
    } catch (error) {
      return res.status(500).json({
        error: "Erro ao criar transação",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "OPTIONS"]);
  return res.status(405).end(`Método ${req.method} não permitido`);
}
