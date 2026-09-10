import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";

// Numeração humanizada diária: OS-YYYYMMDD-SEQ / ORC-YYYYMMDD-SEQ.
// A sequência reinicia todo dia (por tipo) e a data de referência é o
// dia atual no fuso America/Sao_Paulo. A reserva é um upsert atômico
// (ON CONFLICT DO UPDATE) executado DENTRO da transação de criação,
// portanto dois cliques simultâneos nunca geram o mesmo número.

export type TipoNumero = "OS" | "ORC";

type TxClient = Prisma.TransactionClient;

const FUSO = "America/Sao_Paulo";

// Dia atual no fuso de SP como YYYYMMDD (ex.: "20260911").
export function dataHojeSP(data: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(data);
  return partes.replace(/-/g, "");
}

// Reserva e retorna o próximo número do dia para o tipo informado.
export async function reservarNumero(
  tx: TxClient,
  tipo: TipoNumero,
  data?: Date
): Promise<string> {
  const dia = dataHojeSP(data);
  const linhas = await tx.$queryRaw<{ ultimo: number }[]>`
    INSERT INTO contador_diario (id, tipo, data, ultimo)
    VALUES (${randomUUID()}, ${tipo}, ${dia}, 1)
    ON CONFLICT (tipo, data)
    DO UPDATE SET ultimo = contador_diario.ultimo + 1
    RETURNING ultimo`;
  const seq = String(linhas[0].ultimo).padStart(3, "0");
  return `${tipo}-${dia}-${seq}`;
}
