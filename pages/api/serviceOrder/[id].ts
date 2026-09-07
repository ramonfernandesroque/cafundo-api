import type { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../lib/prisma';
import { requireAuth, emailDoToken } from "../../../lib/auth";
import { registrarAuditoria } from "../../../lib/auditoria";
import {
  sincronizarCaixaDaOS,
  excluirOSComCaixa,
  dinheiro,
} from "../../../lib/ordemServicoCaixa";

// Compat: mesmo contrato de /api/ordemServico/[id] (atualiza com reflexo
// no caixa / exclui em cascata). Mantém rota, formato e auth.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    const ordemServico = await prisma.ordemServico.findUnique({
      where: { id: String(id) },
    });
    if (!ordemServico) {
      return res.status(404).json({ error: 'Ordem de Serviço não encontrada' });
    }
    return res.json(ordemServico);
  }

  if (req.method === 'PUT') {
    try {
      const { cliente, preco, descricao, data, maoDeObra, material, formaDePagamento } = req.body;
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
    } catch {
      return res.status(500).json({ error: 'Erro ao atualizar a ordem de serviço' });
    }
  }

  if (req.method === 'DELETE') {
    try {
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
    } catch {
      return res.status(500).json({ error: 'Erro ao excluir a ordem de serviço' });
    }
  }

  res.status(405).end();
}
