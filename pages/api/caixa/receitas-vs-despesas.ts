import type { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';
import { subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // Rota exclusiva do ADMIN (caixa). Sem token -> 401, sem permissão -> 403.
  if (!requireAdmin(req, res)) return;

  try {
    const hoje = new Date();
    const cincoMesesAtras = subMonths(hoje, 4); // traz os últimos 5 meses contando o atual

    // Recupera transações nos últimos 5 meses
    const transacoes = await prisma.transacoesCaixa.findMany({
      where: {
        data: {
          gte: new Date(
            cincoMesesAtras.getFullYear(),
            cincoMesesAtras.getMonth(),
            1
          ),
        },
      },
      select: {
        data: true,
        tipo: true,
        valor: true,
      },
    });

    // Inicializa objeto para resultados agrupados
    const resultadosMap = new Map();

    for (let i = 0; i < 5; i++) {
      const data = subMonths(hoje, i);
      const mes = format(data, "MMM", { locale: ptBR });
      resultadosMap.set(mes, { month: mes, receitas: 0, despesas: 0 });
    }

    transacoes.forEach(({ data, tipo, valor }) => {
      const mes = format(data, "MMM", { locale: ptBR });

      const mesData = resultadosMap.get(mes);
      if (!mesData) return;

      if (tipo === "ENTRADA") {
        mesData.receitas += Number(valor);
      } else if (tipo === "SAIDA") {
        mesData.despesas += Number(valor);
      }
    });

    // Reverte a ordem para exibir do mês mais antigo ao mais recente
    const resultados = Array.from(resultadosMap.values()).reverse();

    res.status(200).json({ data: resultados });
  } catch (error) {
    console.error("Erro ao processar as transações:", error);
    res.status(500).json({ error: "Erro ao processar as transações" });
  }
};

export default handler;
