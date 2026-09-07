import { aplicarCors } from "../../../lib/cors";
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../lib/prisma';
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.SECRET_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  aplicarCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "POST") {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email e senha são obrigatórios." });
      }

      // Busca usuário no banco
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user)
        return res.status(401).json({ error: "Usuário não encontrado" });

      // Verifica senha
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch)
        return res.status(401).json({ error: "Senha incorreta" });

      // Gera token JWT (contrato: { token, role, email })
      if (!SECRET_KEY) {
        console.error("SECRET_KEY não configurada");
        return res.status(500).json({ error: "Erro interno no servidor" });
      }
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        SECRET_KEY,
        { expiresIn: "1h" }
      );

      return res.status(200).json({ token, role: user.role, email: user.email });
    } catch (error) {
      console.error("Erro na API:", error);
      return res.status(500).json({ error: "Erro interno no servidor" });
    }
  }

  res.status(405).json({ error: "Método não permitido" });
}
