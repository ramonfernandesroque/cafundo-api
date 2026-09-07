// Regras críticas: travas (caixa vinculado, usuários) e dinheiro exato.
import { describe, it, expect, afterAll } from "vitest";
import caixaId from "../pages/api/caixa/[id]";
import usuariosIndex from "../pages/api/usuarios/index";
import usuariosId from "../pages/api/usuarios/[id]";
import { dinheiro } from "../lib/ordemServicoCaixa";
import { mockReq, mockRes, limpar, limparAuditoriaVitest, prisma } from "./helpers";

describe("dinheiro()", () => {
  it("normaliza sem float", () => {
    expect(dinheiro("1.234,56")).toBe("1234.56");
    expect(dinheiro("1234,56")).toBe("1234.56");
    expect(dinheiro("1234.56")).toBe("1234.56");
    expect(dinheiro(100)).toBe("100");
    expect(dinheiro("")).toBe("0");
    expect(dinheiro(null)).toBe("0");
    expect(dinheiro("0.07")).toBe("0.07");
    expect(dinheiro("7850.09")).toBe("7850.09");
  });
});

describe("travas do caixa", () => {
  it("DELETE e PUT em lançamento de OS retornam 409", async () => {
    const vinculado = await prisma.transacoesCaixa.findFirst({
      where: { ordemServicoId: { not: null } },
    });
    expect(vinculado).not.toBeNull();

    const del = mockRes();
    await caixaId(mockReq({ method: "DELETE", query: { id: vinculado!.id } }), del);
    expect(del.captured.statusCode).toBe(409);

    const put = mockRes();
    await caixaId(
      mockReq({ method: "PUT", query: { id: vinculado!.id }, body: { valor: "1" } }),
      put
    );
    expect(put.captured.statusCode).toBe(409);
  });

  it("lançamento manual pode ser excluído (200)", async () => {
    const manual = await prisma.transacoesCaixa.create({
      data: {
        data: new Date(),
        descricao: "VITEST manual trava",
        categorias: "OUTROS_RECEBIMENTOS",
        tipo: "ENTRADA",
        valor: "10.00",
      },
    });
    const res = mockRes();
    await caixaId(mockReq({ method: "DELETE", query: { id: manual.id } }), res);
    expect(res.captured.statusCode).toBe(200);
    await limpar({ caixa: [manual.id] });
  });
});

describe("travas de usuários", () => {
  const users: string[] = [];
  const email = `vitest.user.${Date.now()}@teste.com`;

  it("cria e bloqueia duplicado (409)", async () => {
    const req = mockReq({
      method: "POST",
      body: { email, password: "123456", role: "OPERADOR" },
    });
    const res = mockRes();
    await usuariosIndex(req, res);
    expect(res.captured.statusCode).toBe(201);
    expect(res.captured.payload.password).toBeUndefined();
    users.push(res.captured.payload.id);

    const dup = mockRes();
    await usuariosIndex(req, dup);
    expect(dup.captured.statusCode).toBe(409);
  });

  it("sem token retorna 401", async () => {
    const res = mockRes();
    await usuariosIndex(mockReq({ method: "GET", token: null }), res);
    expect(res.captured.statusCode).toBe(401);
  });

  afterAll(async () => {
    await limpar({ users: [...users] });
    await limparAuditoriaVitest();
  });
});
