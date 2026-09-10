// Numeração humanizada: formato OS-YYYYMMDD-SEQ / ORC-YYYYMMDD-SEQ,
// sequência diária incremental e independente por tipo.
import { describe, it, expect, afterAll } from "vitest";
import ordemServicoIndex from "../pages/api/ordemServico/index";
import orcamentoIndex from "../pages/api/orcamento/index";
import { mockReq, mockRes, limpar, limparAuditoriaVitest } from "./helpers";
import { dataHojeSP } from "../lib/numeracao";

const OS_BASE = {
  cliente: "VITEST NUMERO OS",
  preco: "10.00",
  descricao: "teste numero",
  data: "2026-09-09T00:00:00.000Z",
  material: "1.00",
  maoDeObra: "2.00",
  formaDePagamento: "PIX",
};

const ORC_BASE = { ...OS_BASE, cliente: "VITEST NUMERO ORC" };

describe("numeração humanizada", () => {
  const criadasOS: string[] = [];
  const criadosORC: string[] = [];

  afterAll(async () => {
    await limpar({ os: [...criadasOS], orc: [...criadosORC] });
    await limparAuditoriaVitest();
  });

  it("dataHojeSP retorna AAAAMMDD de 8 dígitos", () => {
    expect(dataHojeSP()).toMatch(/^\d{8}$/);
  });

  it("POST OS gera numero OS-AAAAMMDD-SEQ e incrementa no dia", async () => {
    const dia = dataHojeSP();
    const numeros: string[] = [];
    for (let i = 0; i < 2; i++) {
      const res = mockRes();
      await ordemServicoIndex(mockReq({ method: "POST", body: OS_BASE }), res);
      expect(res.captured.statusCode).toBe(201);
      criadasOS.push(res.captured.payload.id);
      numeros.push(res.captured.payload.numero);
    }
    expect(numeros[0]).toMatch(new RegExp(`^OS-${dia}-\\d{3}$`));
    expect(numeros[1]).toMatch(new RegExp(`^OS-${dia}-\\d{3}$`));
    const seq = (n: string) => parseInt(n.split("-")[2], 10);
    expect(seq(numeros[1])).toBe(seq(numeros[0]) + 1);
  });

  it("POST orçamento gera numero ORC-AAAAMMDD-SEQ independente da OS", async () => {
    const dia = dataHojeSP();
    const res = mockRes();
    await orcamentoIndex(mockReq({ method: "POST", body: ORC_BASE }), res);
    expect(res.captured.statusCode).toBe(201);
    criadosORC.push(res.captured.payload.id);
    expect(res.captured.payload.numero).toMatch(
      new RegExp(`^ORC-${dia}-\\d{3}$`)
    );
  });
});
