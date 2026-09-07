import { requireAuth } from "../../lib/auth";
import { aplicarCors } from "../../lib/cors";
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Adiciona os cabeçalhos CORS
  aplicarCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE"); // Métodos permitidos
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Cabeçalhos permitidos
  
  // Se for uma requisição OPTIONS (pré-vôo), responde com sucesso
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!requireAuth(req, res)) return;

  if (req.method === 'GET') {
    try {
      // Compat: alias para ordemServico (modelo serviceOrder não existe no schema).
      const serviceOrder = await prisma.ordemServico.findMany({
        orderBy: { data: "desc" },
      });

      // Verifica se encontrou ordens de serviço
      if (serviceOrder.length === 0) {
        return res.status(404).json({ message: "Nenhuma ordem de serviço encontrada" });
      }

      return res.status(200).json(serviceOrder);
    } catch (error) {
      return res.status(500).json({ error: "Erro ao buscar ordens de serviço", details: error instanceof Error ? error.message : String(error) });
    }
  }
}
