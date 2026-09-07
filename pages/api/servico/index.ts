import { requireAuth } from "../../../lib/auth";
import { aplicarCors } from "../../../lib/cors";
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Adiciona os cabeçalhos CORS (mesmos de antes para não quebrar o front)
  aplicarCors(req, res);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cache-Control"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!requireAuth(req, res)) return;

  if (req.method === "GET") {
    try {
      const servicos = await prisma.servico.findMany();
      return res.json(servicos);
    } catch (error) {
      console.error("Erro ao buscar serviços:", error);
      return res.status(500).json({ error: "Erro ao buscar serviços" });
    }
  }

  if (req.method === "POST") {
    try {
      const { servico, data, valorTotal, material, maoDeObra } = req.body;
      const novoServico = await prisma.servico.create({
        data: {
          servico,
          data,
          valorTotal,
          material,
          maoDeObra,
        },
      });
      return res.status(201).json(novoServico);
    } catch (error) {
      console.error("Erro ao criar serviço:", error);
      return res.status(500).json({ error: "Erro ao criar serviço" });
    }
  }

  res.status(405).end();
}
