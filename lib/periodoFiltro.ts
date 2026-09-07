// Helper compartilhado pelos endpoints de resumo do caixa
// (receita-total, despesas-total, lucro-liquido, lucro).
//
// Dado um filtro de período ("hoje" | "semana" | "mes" | "ano"), devolve o
// intervalo do período atual e do período anterior equivalente, para que os
// cards mostrem "valor do período + variação % vs período anterior".
// Filtro ausente ou inválido cai no comportamento histórico: "mes".

export type FiltroPeriodo = "hoje" | "semana" | "mes" | "ano";

export interface Intervalo {
  gte: Date;
  lt: Date;
}

export interface PeriodoComparativo {
  filtro: FiltroPeriodo;
  atual: Intervalo;
  anterior: Intervalo;
}

function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function somarDias(d: Date, dias: number): Date {
  const copia = new Date(d);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

export function getPeriodoComparativo(
  filtroParam: unknown
): PeriodoComparativo {
  const filtro: FiltroPeriodo =
    filtroParam === "hoje" ||
    filtroParam === "semana" ||
    filtroParam === "mes" ||
    filtroParam === "ano"
      ? filtroParam
      : "mes";

  const agora = new Date();

  switch (filtro) {
    case "hoje": {
      const hoje = inicioDoDia(agora);
      return {
        filtro,
        atual: { gte: hoje, lt: somarDias(hoje, 1) },
        anterior: { gte: somarDias(hoje, -1), lt: hoje },
      };
    }
    case "semana": {
      // Semana de segunda a domingo
      const hoje = inicioDoDia(agora);
      const diaSemana = (hoje.getDay() + 6) % 7; // seg=0 ... dom=6
      const inicioSemana = somarDias(hoje, -diaSemana);
      return {
        filtro,
        atual: { gte: inicioSemana, lt: somarDias(inicioSemana, 7) },
        anterior: {
          gte: somarDias(inicioSemana, -7),
          lt: inicioSemana,
        },
      };
    }
    case "ano": {
      const inicioAno = new Date(agora.getFullYear(), 0, 1);
      const inicioAnoAnterior = new Date(agora.getFullYear() - 1, 0, 1);
      return {
        filtro,
        atual: { gte: inicioAno, lt: new Date(agora.getFullYear() + 1, 0, 1) },
        anterior: { gte: inicioAnoAnterior, lt: inicioAno },
      };
    }
    case "mes":
    default: {
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const inicioMesAnterior = new Date(
        agora.getFullYear(),
        agora.getMonth() - 1,
        1
      );
      return {
        filtro,
        atual: {
          gte: inicioMes,
          lt: new Date(agora.getFullYear(), agora.getMonth() + 1, 1),
        },
        anterior: { gte: inicioMesAnterior, lt: inicioMes },
      };
    }
  }
}
