import { aplicarCors } from "../../../lib/cors";
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../lib/prisma';
import bcrypt from "bcryptjs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  aplicarCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "POST") {
    try {
      const { action, email, password, role } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email e senha são obrigatórios." });
      }

      if (action === "register") {
        // Verifica se o usuário já existe
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          return res.status(400).json({ error: "Usuário já existe." });
        }

        // Papel opcional (ADMIN|OPERADOR); padrão: OPERADOR
        const userRole = role === "ADMIN" ? "ADMIN" : "OPERADOR";

        // Criptografa a senha e cria o usuário
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
          data: { email, password: hashedPassword, role: userRole },
        });

        return res.status(201).json({
          message: "Usuário criado com sucesso",
          user: { email: newUser.email, role: newUser.role, createdAt: newUser.createdAt },
        });
      }

      if (action === "login") {
        // Busca usuário no banco
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user)
          return res.status(401).json({ error: "Usuário não encontrado" });

        // Verifica senha
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch)
          return res.status(401).json({ error: "Senha incorreta" });

        // Não vazar o hash da senha (contrato: { message, user })
        const safeUser = {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        };
        return res.status(200).json({ message: "Login bem-sucedido", user: safeUser });
      }

      return res.status(400).json({ error: "Ação inválida." });
    } catch (error) {
      console.error("Erro na API:", error);
      return res.status(500).json({ error: "Erro interno no servidor" });
    }
  }

  res.status(405).json({ error: "Método não permitido" });
}
