import { requireAuth } from "../../../lib/auth";
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../lib/prisma';
import { emailDoToken } from '../../../lib/auth';
import { registrarAuditoria } from '../../../lib/auditoria';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return;
  if (req.method === "GET") {
    const { nome } = req.query;

    if (nome) {
      const clientes = await prisma.cliente.findMany({
        where: {
          nome: {
            contains: String(nome), // Busca nomes que contenham a string fornecida
            mode: "insensitive", // Ignora maiúsculas e minúsculas
          },
        },
        select: {
          nome: true, // Retorna apenas o nome
        },
      });
      return res.json(clientes);
    }

    const clientes = await prisma.cliente.findMany();
    return res.json(clientes);
  }

  if (req.method === "POST") {
    const {
      nome,
      documento,
      telefone,
      celular,
      email,
      endereco,
      cidade,
      bairro,
      cep,
    } = req.body;

    const novoCliente = await prisma.$transaction(async (tx) => {
      const criado = await tx.cliente.create({
        data: {
          nome,
          documento,
          telefone,
          celular,
          email,
          endereco,
          cidade,
          bairro,
          cep,
        },
      });
      await registrarAuditoria(tx, {
        usuario: emailDoToken(req),
        acao: "CRIAR",
        entidade: "CLIENTE",
        entidadeId: criado.id,
        descricao: criado.nome,
      });
      return criado;
    });

    return res.status(201).json(novoCliente);
  }

  res.status(405).end();
}
