import type { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';
import {
  subDays,
  subMonths,
  startOfDay,
  endOfDay,
  startOfWeek,
  format,
  parseISO,
  differenceInDays,
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // Rota exclusiva do ADMIN (relatórios). Sem token -> 401, sem permissão -> 403.
  if (!requireAdmin(req, res)) return;

  try {
    const { filtro, startDate, endDate, modo } = req.query;

    const hoje = new Date();
    let dataInicio;
    let dataFim = hoje;

    switch (filtro) {
      case "dia":
        dataInicio = startOfDay(hoje);
        break;
      case "semana":
        dataInicio = startOfWeek(hoje, { weekStartsOn: 1 });
        break;
      case "periodo":
        if (!startDate || !endDate) {
          return res.status(400).json({
            error:
              "startDate e endDate são obrigatórios para o filtro 'periodo'",
          });
        }
        dataInicio = startOfDay(parseISO(String(startDate)));
        dataFim = endOfDay(parseISO(String(endDate)));
        break;
      default:
        if (!isNaN(Number(filtro))) {
          const dias = parseInt(String(filtro), 10);
          dataInicio = subDays(hoje, dias);
        } else {
          dataInicio = new Date(
            subMonths(hoje, 4).getFullYear(),
            subMonths(hoje, 4).getMonth(),
            1
          );
        }
        break;
    }

    let agruparPorDia = false;

    if (modo === "diario") {
      agruparPorDia = true;
    } else if (modo === "mensal") {
      agruparPorDia = false;
    } else {
      agruparPorDia = differenceInDays(dataFim, dataInicio) < 35;
    }

    const transacoes = await prisma.transacoesCaixa.findMany({
      where: {
        data: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      select: {
        data: true,
        tipo: true,
        valor: true,
      },
    });

    const resultadosMap = new Map<string, { label: string; receitas: number; despesas: number }>();

    transacoes.forEach(({ data, tipo, valor }) => {
      const label = agruparPorDia
        ? format(data, "dd/MM/yyyy", { locale: ptBR }) // <- Aqui o ajuste
        : format(data, "MMM/yyyy", { locale: ptBR });

      if (!resultadosMap.has(label)) {
        resultadosMap.set(label, { label, receitas: 0, despesas: 0 });
      }

      const item = resultadosMap.get(label);
      if (!item) return;
      if (tipo === "ENTRADA") {
        item.receitas += Number(valor);
      } else if (tipo === "SAIDA") {
        item.despesas += Number(valor);
      }
    });

    const resultadosOrdenados = Array.from(resultadosMap.values()).sort(
      (a, b) => {
        const [aDia, aMes, aAno] = a.label.split("/").map(Number);
        const [bDia, bMes, bAno] = b.label.split("/").map(Number);
        return (
          new Date(aAno, aMes - 1, aDia).getTime() -
          new Date(bAno, bMes - 1, bDia).getTime()
        );
      }
    );

    res.status(200).json({ data: resultadosOrdenados });
  } catch (error) {
    console.error("Erro ao processar as transações:", error);
    res.status(500).json({ error: "Erro ao processar as transações" });
  }
};

export default handler;
