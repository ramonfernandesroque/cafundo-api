// Regras críticas: OS <-> caixa (criar, atualizar, excluir em cascata).
import { describe, it, expect, afterAll } from "vitest";
import ordemServicoIndex from "../pages/api/ordemServico/index";
import ordemServicoId from "../pages/api/ordemServico/[id]";
import { mockReq, mockRes, limpar, limparAuditoriaVitest, prisma } from "./helpers";

const OS_BASE = {
  cliente: "VITEST OS",
  preco: "100.55",
  descricao: "OS de teste",
  data: "2026-09-07T00:00:00.000Z",
  material: "10.10",
  maoDeObra: "20.20",
  formaDePagamento: "PIX",
};

describe("ordemServico <-> caixa", () => {
  const criadas: string[] = [];

  afterAll(async () => {
    await limpar({ os: [...criadas] });
    await limparAuditoriaVitest();
  });

  it("POST cria OS + caixa vinculado + auditoria, com autoria e centavos exatos", async () => {
    const req = mockReq({ method: "POST", body: OS_BASE });
    const res = mockRes();
    await ordemServicoIndex(req, res);
    expect(res.captured.statusCode).toBe(201);
    const os = res.captured.payload;
    criadas.push(os.id);
    expect(os.criadoPor).toBe("vitest@teste.com");

    const cx = await prisma.transacoesCaixa.findMany({
      where: { ordemServicoId: os.id },
    });
    expect(cx).toHaveLength(1);
    expect(cx[0].valor.toString()).toBe("100.55");
    expect(cx[0].criadoPor).toBe("vitest@teste.com");

    const audit = await prisma.auditoria.findMany({
      where: { entidadeId: os.id, acao: "CRIAR" },
    });
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it("PUT atualiza OS e reflete valor no caixa", async () => {
    const osId = criadas[0];
    const req = mockReq({
      method: "PUT",
      query: { id: osId },
      body: { ...OS_BASE, preco: "250.75", descricao: "OS alterada" },
    });
    const res = mockRes();
    await ordemServicoId(req, res);
    expect(res.captured.statusCode).toBe(200);

    const cx = await prisma.transacoesCaixa.findMany({
      where: { ordemServicoId: osId },
    });
    expect(cx).toHaveLength(1);
    expect(cx[0].valor.toString()).toBe("250.75");
    expect(cx[0].descricao).toContain("OS alterada");
  });

  it("DELETE exclui OS + caixa vinculado + registra auditoria", async () => {
    const osId = criadas[0];
    const req = mockReq({ method: "DELETE", query: { id: osId } });
    const res = mockRes();
    await ordemServicoId(req, res);
    expect(res.captured.statusCode).toBe(200);

    expect(await prisma.ordemServico.findUnique({ where: { id: osId } })).toBeNull();
    expect(
      await prisma.transacoesCaixa.findMany({ where: { ordemServicoId: osId } })
    ).toHaveLength(0);
    const audit = await prisma.auditoria.findMany({
      where: { entidadeId: osId, acao: "EXCLUIR" },
    });
    expect(audit.length).toBeGreaterThanOrEqual(1);
    criadas.length = 0;
  });

  it("POST anônimo é bloqueado (401)", async () => {
    const req = mockReq({ method: "POST", body: { ...OS_BASE, cliente: "VITEST ANON" }, token: null });
    const res = mockRes();
    await ordemServicoIndex(req, res);
    expect(res.captured.statusCode).toBe(401);
  });
});
