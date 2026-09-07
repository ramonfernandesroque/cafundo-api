// Regras críticas: orçamento (sem caixa) -> conversão -> propagação -> cascata.
import { describe, it, expect, afterAll } from "vitest";
import orcamentoIndex from "../pages/api/orcamento/index";
import orcamentoId from "../pages/api/orcamento/[id]";
import convert from "../pages/api/orcamento/convert";
import { mockReq, mockRes, limpar, limparAuditoriaVitest, prisma } from "./helpers";

const ORC_BASE = {
  cliente: "VITEST ORC",
  preco: "500.40",
  descricao: "Orçamento de teste",
  data: "2026-09-07T00:00:00.000Z",
  material: "100.00",
  maoDeObra: "150.00",
  formaDePagamento: "DINHEIRO",
  status: "PENDENTE",
};

async function criarOrcamento(over: Record<string, unknown> = {}) {
  const req = mockReq({ method: "POST", body: { ...ORC_BASE, ...over } });
  const res = mockRes();
  await orcamentoIndex(req, res);
  expect(res.captured.statusCode).toBe(201);
  return res.captured.payload.id as string;
}

describe("orcamento", () => {
  const orcs: string[] = [];
  const oss: string[] = [];

  it("POST cria orçamento SEM lançar no caixa", async () => {
    const id = await criarOrcamento();
    orcs.push(id);
    const cx = await prisma.transacoesCaixa.findMany({
      where: { descricao: { contains: "VITEST ORC" } },
    });
    expect(cx).toHaveLength(0);
  });

  it("convert cria OS + caixa + marca APROVADO + audita", async () => {
    const id = orcs[0];
    const req = mockReq({ method: "POST", body: { id } });
    const res = mockRes();
    await convert(req, res);
    expect(res.captured.statusCode).toBe(201);
    const { orcamento, ordemServico } = res.captured.payload;
    expect(orcamento.status).toBe("APROVADO");
    expect(orcamento.ordemServicoId).toBe(ordemServico.id);
    oss.push(ordemServico.id);

    const cx = await prisma.transacoesCaixa.findMany({
      where: { ordemServicoId: ordemServico.id },
    });
    expect(cx).toHaveLength(1);
    expect(Number(cx[0].valor)).toBe(500.4);

    const audit = await prisma.auditoria.findMany({
      where: { entidadeId: id, acao: "CONVERTER" },
    });
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it("PUT em APROVADO propaga para OS e caixa", async () => {
    const id = orcs[0];
    const req = mockReq({ method: "PUT", query: { id }, body: { preco: "700.20" } });
    const res = mockRes();
    await orcamentoId(req, res);
    expect(res.captured.statusCode).toBe(200);

    const os = await prisma.ordemServico.findUnique({ where: { id: oss[0] } });
    expect(Number(os?.preco)).toBe(700.2);
    const cx = await prisma.transacoesCaixa.findMany({
      where: { ordemServicoId: oss[0] },
    });
    expect(Number(cx[0].valor)).toBe(700.2);
  });

  it("DELETE em APROVADO exclui em cascata (OS + caixa + orçamento)", async () => {
    const id = orcs[0];
    const req = mockReq({ method: "DELETE", query: { id } });
    const res = mockRes();
    await orcamentoId(req, res);
    expect(res.captured.statusCode).toBe(200);

    expect(await prisma.orcamento.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.ordemServico.findUnique({ where: { id: oss[0] } })).toBeNull();
    expect(
      await prisma.transacoesCaixa.findMany({ where: { ordemServicoId: oss[0] } })
    ).toHaveLength(0);
    orcs.length = 0;
    oss.length = 0;
  });

  it("convert bloqueia RECUSADO", async () => {
    const id = await criarOrcamento({ cliente: "VITEST REC", status: "RECUSADO" });
    orcs.push(id);
    const req = mockReq({ method: "POST", body: { id } });
    const res = mockRes();
    await convert(req, res);
    expect(res.captured.statusCode).toBe(400);
  });

  it("convert bloqueia validade expirada e marca EXPIRADO", async () => {
    const id = await criarOrcamento({ cliente: "VITEST EXP", validade: "2020-01-01T00:00:00.000Z" });
    orcs.push(id);
    const req = mockReq({ method: "POST", body: { id } });
    const res = mockRes();
    await convert(req, res);
    expect(res.captured.statusCode).toBe(400);
    const orc = await prisma.orcamento.findUnique({ where: { id } });
    expect(orc?.status).toBe("EXPIRADO");
  });

  afterAll(async () => {
    await limpar({ orc: [...orcs], os: [...oss] });
    await limparAuditoriaVitest();
  });
});
