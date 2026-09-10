import type { Prisma, ordemServicoformaDePagamento } from "@prisma/client";
import { reservarNumero } from "./numeracao";

// Cliente de transação (prisma.$transaction(async (tx) => ...)).
export type TxClient = Prisma.TransactionClient;

export const descricaoOS = (
  cliente: string | null | undefined,
  descricao: string | null | undefined
) =>
  `Ordem de serviço - ${cliente ?? ""}${descricao ? ` - ${descricao}` : ""}`.slice(
    0,
    255
  );

// Normaliza dinheiro para string decimal ("1234.56") antes de entregar ao
// Prisma: evita float binário no caminho (centavos preservados). Aceita
// number, string pt-BR ("1.234,56"), string SQL ("1234.56") e Decimal.
export const dinheiro = (v: unknown): string => {
  if (v === null || v === undefined) return "0";
  const s = String(v).trim();
  if (s === "") return "0";
  if (s.includes(",")) return s.replace(/\./g, "").replace(",", ".");
  return s;
};

export interface DadosOS {
  cliente: string;
  preco: number | string;
  descricao: string;
  data: Date | string;
  maoDeObra: number | string;
  material: number | string;
  formaDePagamento: ordemServicoformaDePagamento;
}

interface DadosCaixaOS {
  cliente: string;
  preco: number | string;
  descricao: string;
  data: Date | string;
}

// Cria a OS + lançamento no caixa (ENTRADA/SERVICOS) já vinculado.
// Retorna a ordem criada.
export async function criarOSComCaixa(
  tx: TxClient,
  dados: DadosOS,
  usuario?: string | null
) {
  const ordemServico = await tx.ordemServico.create({
    data: {
      numero: await reservarNumero(tx, "OS"),
      cliente: dados.cliente,
      preco: dinheiro(dados.preco),
      descricao: dados.descricao,
      data: new Date(dados.data),
      maoDeObra: dinheiro(dados.maoDeObra),
      material: dinheiro(dados.material),
      formaDePagamento: dados.formaDePagamento,
      criadoPor: usuario ?? null,
      atualizadoPor: usuario ?? null,
    },
  });

  await tx.transacoesCaixa.create({
    data: {
      data: new Date(dados.data),
      descricao: descricaoOS(dados.cliente, dados.descricao),
      categorias: "SERVICOS",
      tipo: "ENTRADA",
      valor: dinheiro(dados.preco),
      ordemServicoId: ordemServico.id,
      criadoPor: usuario ?? null,
      atualizadoPor: usuario ?? null,
    },
  });

  return ordemServico;
}

// Sincroniza o(s) lançamento(s) vinculado(s) a uma OS após edição:
// atualiza valor/data/descrição; se não houver vínculo (registros
// antigos), cria o lançamento para amarrar daqui em diante.
export async function sincronizarCaixaDaOS(
  tx: TxClient,
  ordemServicoId: string,
  dados: DadosCaixaOS,
  usuario?: string | null
) {
  const vinculados = await tx.transacoesCaixa.findMany({
    where: { ordemServicoId },
  });

  if (vinculados.length === 0) {
    await tx.transacoesCaixa.create({
      data: {
        data: new Date(dados.data),
        descricao: descricaoOS(dados.cliente, dados.descricao),
        categorias: "SERVICOS",
        tipo: "ENTRADA",
        valor: dinheiro(dados.preco),
        ordemServicoId,
        criadoPor: usuario ?? null,
        atualizadoPor: usuario ?? null,
      },
    });
    return;
  }

  for (const lanc of vinculados) {
    await tx.transacoesCaixa.update({
      where: { id: lanc.id },
      data: {
        data: new Date(dados.data),
        descricao: descricaoOS(dados.cliente, dados.descricao),
        valor: dinheiro(dados.preco),
        atualizadoPor: usuario ?? null,
      },
    });
  }
}

// Exclui OS + lançamentos vinculados + reabre orçamento de origem
// (volta para PENDENTE sem vínculo).
export async function excluirOSComCaixa(tx: TxClient, ordemServicoId: string) {
  await tx.transacoesCaixa.deleteMany({ where: { ordemServicoId } });
  const ordemServico = await tx.ordemServico.delete({
    where: { id: ordemServicoId },
  });
  await tx.orcamento.updateMany({
    where: { ordemServicoId },
    data: { status: "PENDENTE", ordemServicoId: null },
  });
  return ordemServico;
}
