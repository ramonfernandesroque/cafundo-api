// Backfill (uso único): atribui numero OS-YYYYMMDD-SEQ / ORC-YYYYMMDD-SEQ
// aos registros criados antes da numeração humanizada, agrupando por dia
// (OS pela data do serviço, ORC pela data de criação) e atualizando o
// contador_diario para que as próximas criações continuem a sequência.
// Uso: node scripts/backfill-numero.mjs
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Dia no fuso America/Sao_Paulo como YYYYMMDD (cópia local de lib/numeracao
// para o script rodar em node puro, sem transpilar TypeScript).
function dataHojeSP(data = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(data)
    .replace(/-/g, "");
}

async function backfill(tipo, registros, formatar) {
  const porDia = new Map();
  for (const r of registros) {
    const dia = dataHojeSP(r._dia);
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(r);
  }
  let total = 0;
  for (const [dia, lista] of [...porDia.entries()].sort()) {
    let seq = 0;
    for (const r of lista) {
      seq += 1;
      const numero = formatar(dia, seq);
      if (tipo === "OS") {
        await prisma.ordemServico.update({
          where: { id: r.id },
          data: { numero },
        });
      } else {
        await prisma.orcamento.update({
          where: { id: r.id },
          data: { numero },
        });
      }
      total += 1;
    }
    await prisma.contadorDiario.upsert({
      where: { tipo_data: { tipo, data: dia } },
      update: { ultimo: Math.max(seq) },
      create: { tipo, data: dia, ultimo: seq },
    });
    // Se o contador já estava à frente (criações novas no mesmo dia),
    // preserva o maior valor.
    const atual = await prisma.contadorDiario.findUnique({
      where: { tipo_data: { tipo, data: dia } },
    });
    if (atual && atual.ultimo < seq) {
      await prisma.contadorDiario.update({
        where: { tipo_data: { tipo, data: dia } },
        data: { ultimo: seq },
      });
    }
  }
  return total;
}

const oss = (
  await prisma.ordemServico.findMany({
    where: { numero: null },
    orderBy: [{ data: "asc" }, { id: "asc" }],
    select: { id: true, data: true },
  })
).map((r) => ({ ...r, _dia: new Date(r.data) }));

const orcs = (
  await prisma.orcamento.findMany({
    where: { numero: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, createdAt: true },
  })
).map((r) => ({ ...r, _dia: new Date(r.createdAt) }));

const nOS = await backfill(
  "OS",
  oss,
  (dia, seq) => `OS-${dia}-${String(seq).padStart(3, "0")}`
);
const nORC = await backfill(
  "ORC",
  orcs,
  (dia, seq) => `ORC-${dia}-${String(seq).padStart(3, "0")}`
);

console.log(`Backfill concluído: ${nOS} OS + ${nORC} orçamentos numerados.`);
await prisma.$disconnect();
