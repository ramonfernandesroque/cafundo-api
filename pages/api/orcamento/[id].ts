import { requireAuth } from "../../../lib/auth";
import { aplicarCors } from "../../../lib/cors";
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";
import {
  criarOSComCaixa,
  sincronizarCaixaDaOS,
  dinheiro,
} from "../../../lib/ordemServicoCaixa";
import { emailDoToken } from "../../../lib/auth";
import { registrarAuditoria } from "../../../lib/auditoria";

const cors = (req: NextApiRequest, res: NextApiResponse) => {
  aplicarCors(req, res);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Access-Control-Allow-Headers, cache-control"
  );
};

// Propaga alterações de um orçamento APROVADO para a OS gerada e o caixa.
// A data da OS é mantida (data da conversão); demais campos sincronizam.
async function propagarParaOSECaixa(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  ordemServicoId: string,
  dados: {
    cliente: string;
    preco: number | string;
    descricao: string;
    maoDeObra: number | string;
    material: number | string;
    formaDePagamento: Parameters<typeof criarOSComCaixa>[1]["formaDePagamento"];
  }
) {
  const os = await tx.ordemServico.update({
    where: { id: ordemServicoId },
    data: {
      cliente: dados.cliente,
      preco: dados.preco,
      descricao: dados.descricao,
      maoDeObra: dados.maoDeObra,
      material: dados.material,
      formaDePagamento: dados.formaDePagamento,
    },
  });

  await sincronizarCaixaDaOS(tx, ordemServicoId, {
    cliente: os.cliente,
    preco: os.preco.toString(),
    descricao: os.descricao,
    data: os.data,
  });

  return os;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAuth(req, res)) return;

  const { id } = req.query;

  if (req.method === "GET") {
    const orcamento = await prisma.orcamento.findUnique({
      where: { id: String(id) },
    });
    if (!orcamento) {
      return res.status(404).json({ error: "Orçamento não encontrado" });
    }
    return res.json(orcamento);
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
        validade,
        status,
      } = req.body;

      const usuario = emailDoToken(req);
      // Dinheiro como string até o Prisma (sem float no caminho)
      const nPreco = preco !== undefined ? dinheiro(preco) : undefined;
      const nMao = maoDeObra !== undefined ? dinheiro(maoDeObra) : undefined;
      const nMat = material !== undefined ? dinheiro(material) : undefined;

      const atual = await prisma.orcamento.findUnique({
        where: { id: String(id) },
      });
      if (!atual) {
        return res.status(404).json({ error: "Orçamento não encontrado" });
      }

      // Orçamento já convertido: permite editar os dados (reflete na OS
      // e no caixa), mas não permite desfazer a conversão por aqui —
      // para isso, exclua a OS (o orçamento volta a PENDENTE).
      if (atual.status === "APROVADO" && status && status !== "APROVADO") {
        return res.status(400).json({
          error:
            "Orçamento já convertido em ordem de serviço. Para desfazer, exclua a ordem de serviço.",
        });
      }

      // Marcando como APROVADO pela edição sem ter OS vinculada:
      // executa a conversão (cria OS + lança no caixa).
      if (
        status === "APROVADO" &&
        atual.status !== "APROVADO" &&
        !atual.ordemServicoId
      ) {
        if (atual.status === "RECUSADO") {
          return res
            .status(400)
            .json({ error: "Orçamento recusado não pode virar OS" });
        }
        const resultado = await prisma.$transaction(async (tx) => {
          const ordemServico = await criarOSComCaixa(
            tx,
            {
              cliente: cliente ?? atual.cliente,
              preco: preco !== undefined ? dinheiro(preco) : dinheiro(atual.preco),
              descricao: descricao ?? atual.descricao,
              data: new Date(),
              maoDeObra: maoDeObra !== undefined ? dinheiro(maoDeObra) : dinheiro(atual.maoDeObra),
              material: material !== undefined ? dinheiro(material) : dinheiro(atual.material),
              formaDePagamento: formaDePagamento ?? atual.formaDePagamento,
            },
            usuario
          );
          const orcamento = await tx.orcamento.update({
            where: { id: String(id) },
            data: {
              ...(cliente !== undefined ? { cliente } : {}),
              ...(nPreco !== undefined ? { preco: nPreco } : {}),
              ...(descricao !== undefined ? { descricao } : {}),
              ...(data !== undefined ? { data } : {}),
              ...(nMao !== undefined ? { maoDeObra: nMao } : {}),
              ...(nMat !== undefined ? { material: nMat } : {}),
              ...(formaDePagamento !== undefined ? { formaDePagamento } : {}),
              ...(validade !== undefined
                ? { validade: validade ? new Date(validade) : null }
                : {}),
              status: "APROVADO",
              ordemServicoId: ordemServico.id,
              atualizadoPor: usuario,
            },
          });
          await registrarAuditoria(tx, {
            usuario,
            acao: "CONVERTER",
            entidade: "ORCAMENTO",
            entidadeId: String(id),
            descricao: `${orcamento.cliente} — virou OS ${ordemServico.id}`,
          });
          return { orcamento, ordemServico };
        });
        return res.json(resultado);
      }

      // Edição de orçamento APROVADO (com OS): propaga para OS + caixa.
      if (atual.status === "APROVADO" && atual.ordemServicoId) {
        const resultado = await prisma.$transaction(async (tx) => {
          const orcamento = await tx.orcamento.update({
            where: { id: String(id) },
            data: {
              ...(cliente !== undefined ? { cliente } : {}),
              ...(nPreco !== undefined ? { preco: nPreco } : {}),
              ...(descricao !== undefined ? { descricao } : {}),
              ...(data !== undefined ? { data } : {}),
              ...(nMao !== undefined ? { maoDeObra: nMao } : {}),
              ...(nMat !== undefined ? { material: nMat } : {}),
              ...(formaDePagamento !== undefined ? { formaDePagamento } : {}),
              ...(validade !== undefined
                ? { validade: validade ? new Date(validade) : null }
                : {}),
              atualizadoPor: usuario,
            },
          });
          const ordemServico = await propagarParaOSECaixa(
            tx,
            atual.ordemServicoId as string,
            {
              cliente: orcamento.cliente,
              preco: dinheiro(orcamento.preco),
              descricao: orcamento.descricao,
              maoDeObra: dinheiro(orcamento.maoDeObra),
              material: dinheiro(orcamento.material),
              formaDePagamento: orcamento.formaDePagamento,
            }
          );
          await tx.ordemServico.update({
            where: { id: atual.ordemServicoId as string },
            data: { atualizadoPor: usuario },
          });
          await registrarAuditoria(tx, {
            usuario,
            acao: "ATUALIZAR",
            entidade: "ORCAMENTO",
            entidadeId: String(id),
            descricao: `${orcamento.cliente} — refletido na OS e no caixa`,
          });
          return { orcamento, ordemServico };
        });
        return res.json(resultado.orcamento);
      }

      // Edição simples (PENDENTE/RECUSADO/EXPIRADO): sem caixa envolvido.
      const orcamento = await prisma.orcamento.update({
        where: { id: String(id) },
        data: {
          ...(cliente !== undefined ? { cliente } : {}),
          ...(nPreco !== undefined ? { preco: nPreco } : {}),
          ...(descricao !== undefined ? { descricao } : {}),
          ...(data !== undefined ? { data } : {}),
          ...(nMao !== undefined ? { maoDeObra: nMao } : {}),
          ...(nMat !== undefined ? { material: nMat } : {}),
          ...(formaDePagamento !== undefined ? { formaDePagamento } : {}),
          ...(validade !== undefined
            ? { validade: validade ? new Date(validade) : null }
            : {}),
          ...(status ? { status } : {}),
          atualizadoPor: usuario,
        },
      });
      await registrarAuditoria(prisma, {
        usuario,
        acao: "ATUALIZAR",
        entidade: "ORCAMENTO",
        entidadeId: String(id),
        descricao: `${orcamento.cliente} — ${orcamento.descricao}`,
      });
      return res.json(orcamento);
    } catch (error) {
      console.error("Erro ao atualizar orçamento:", error);
      return res.status(500).json({
        error: "Erro ao atualizar o orçamento",
        details:
          process.env.NODE_ENV !== "production"
            ? String((error as Error)?.message ?? error)
            : undefined,
      });
    }
  }

  if (req.method === "DELETE") {
    try {
      const atual = await prisma.orcamento.findUnique({
        where: { id: String(id) },
      });
      if (!atual) {
        return res.status(404).json({ error: "Orçamento não encontrado" });
      }

      // Orçamento convertido: exclui em cascata o lançamento no caixa,
      // a ordem de serviço gerada e o próprio orçamento.
      if (atual.status === "APROVADO" && atual.ordemServicoId) {
        const osId = atual.ordemServicoId;
        await prisma.$transaction(async (tx) => {
          await tx.transacoesCaixa.deleteMany({
            where: { ordemServicoId: osId },
          });
          await tx.ordemServico.deleteMany({ where: { id: osId } });
          await tx.orcamento.delete({ where: { id: String(id) } });
          await registrarAuditoria(tx, {
            usuario: emailDoToken(req),
            acao: "EXCLUIR",
            entidade: "ORCAMENTO",
            entidadeId: String(id),
            descricao: `${atual.cliente} — excluído em cascata com OS e caixa`,
          });
        });
        return res.json({ deleted: true, cascata: true });
      }

      const orcamento = await prisma.orcamento.delete({
        where: { id: String(id) },
      });
      await registrarAuditoria(prisma, {
        usuario: emailDoToken(req),
        acao: "EXCLUIR",
        entidade: "ORCAMENTO",
        entidadeId: String(id),
        descricao: `${orcamento.cliente} — ${orcamento.descricao}`,
      });
      return res.json(orcamento);
    } catch (error) {
      console.error("Erro ao excluir orçamento:", error);
      return res.status(500).json({ error: "Erro ao excluir o orçamento" });
    }
  }

  return res.status(405).end();
}
