import { requireAuth } from "../../../lib/auth";
import { aplicarCors } from "../../../lib/cors";
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../lib/prisma';
import {
  sincronizarCaixaDaOS,
  excluirOSComCaixa,
} from "../../../lib/ordemServicoCaixa";
import { emailDoToken } from "../../../lib/auth";
import { dinheiro } from "../../../lib/ordemServicoCaixa";
import { registrarAuditoria } from "../../../lib/auditoria";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Adiciona os cabeçalhos CORS
  aplicarCors(req, res);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE"
  ); // Métodos permitidos
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization,  Access-Control-Allow-Headers, cache-control"
  ); // Cabeçalhos permitidos

  // Tratamento para o método OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(200).end(); // Responde com status 200 para as requisições OPTIONS
  }
  if (!requireAuth(req, res)) return;

  const { id } = req.query;

  if (req.method === "GET") {
    const ordemServico = await prisma.ordemServico.findUnique({
      where: { id: String(id) },
    });
    if (!ordemServico) {
      return res.status(404).json({ error: "Ordem de Serviço não encontrada" });
    }
    return res.json(ordemServico);
  }

  if (req.method === "PUT") {
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

      // Atualiza a OS e reflete no caixa (valor/data/descrição do
      // lançamento vinculado) dentro da mesma transação. Registra
      // autoria e auditoria junto.
      const usuario = emailDoToken(req);
      const ordemServico = await prisma.$transaction(async (tx) => {
        const atualizada = await tx.ordemServico.update({
          where: { id: String(id) },
          data: {
            cliente,
            preco: dinheiro(preco),
            descricao,
            data,
            maoDeObra: dinheiro(maoDeObra),
            material: dinheiro(material),
            formaDePagamento,
            atualizadoPor: usuario,
          },
        });

        await sincronizarCaixaDaOS(
          tx,
          String(id),
          {
            cliente: atualizada.cliente,
            preco: atualizada.preco.toString(),
            descricao: atualizada.descricao,
            data: atualizada.data,
          },
          usuario
        );

        await registrarAuditoria(tx, {
          usuario,
          acao: "ATUALIZAR",
          entidade: "ORDEM_SERVICO",
          entidadeId: String(id),
          descricao: `${atualizada.cliente} — ${atualizada.descricao}`,
        });

        return atualizada;
      });

      return res.json(ordemServico);
    } catch (error) {
      console.error("Erro ao atualizar:", error); // Log de erro
      return res
        .status(500)
        .json({ error: "Erro ao atualizar a ordem de serviço" });
    }
  }

  if (req.method === "DELETE") {
    try {
      // Exclui a OS + lançamento(s) vinculado(s) no caixa e reabre o
      // orçamento de origem (se houver), tudo em transação, com auditoria.
      const usuario = emailDoToken(req);
      const ordemServico = await prisma.$transaction(async (tx) => {
        const excluida = await excluirOSComCaixa(tx, String(id));
        await registrarAuditoria(tx, {
          usuario,
          acao: "EXCLUIR",
          entidade: "ORDEM_SERVICO",
          entidadeId: String(id),
          descricao: `${excluida.cliente} — ${excluida.descricao}`,
        });
        return excluida;
      });
      return res.json(ordemServico);
    } catch (error) {
      console.error("Erro ao excluir:", error);
      return res
        .status(500)
        .json({ error: "Erro ao excluir a ordem de serviço" });
    }
  }

  res.status(405).end(); // Método não permitido
}
