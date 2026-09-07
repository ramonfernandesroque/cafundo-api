import { requireAuth } from "../../../lib/auth";
import { aplicarCors } from "../../../lib/cors";
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../lib/prisma';
import { emailDoToken } from '../../../lib/auth';
import { registrarAuditoria } from '../../../lib/auditoria';

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
    const cliente = await prisma.cliente.findUnique({
      where: { id: String(id) },
    });
    if (!cliente) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    return res.json(cliente);
  }

  if (req.method === "PUT") {
    try {
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

      // Log dos dados recebidos
      console.log("Dados recebidos:", {
        nome,
        documento,
        telefone,
        celular,
        email,
        endereco,
        cidade,
        bairro,
        cep,
      });

      // Verificando o id
      console.log("ID do cliente:", id);

      const cliente = await prisma.$transaction(async (tx) => {
        const atualizado = await tx.cliente.update({
          where: { id: String(id) },
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
          acao: "ATUALIZAR",
          entidade: "CLIENTE",
          entidadeId: String(id),
          descricao: atualizado.nome,
        });
        return atualizado;
      });

      console.log("Cliente atualizado:", cliente);
      return res.json(cliente);
    } catch (error) {
      console.error("Erro ao atualizar:", error); // Log de erro
      return res.status(500).json({ error: "Erro ao atualizar o cliente" });
    }
  }

  if (req.method === "DELETE") {
    const cliente = await prisma.$transaction(async (tx) => {
      const excluido = await tx.cliente.delete({
        where: { id: String(id) },
      });
      await registrarAuditoria(tx, {
        usuario: emailDoToken(req),
        acao: "EXCLUIR",
        entidade: "CLIENTE",
        entidadeId: String(id),
        descricao: excluido.nome,
      });
      return excluido;
    });
    return res.json(cliente);
  }

  res.status(405).end(); // Método não permitido
}
