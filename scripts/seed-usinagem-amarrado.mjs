// Seed usinagem amarrado: 30 clientes + 100 OS (com caixa + auditoria)
// + 30 orçamentos (1 por cliente, 10 APROVADO vinculados a OS do mesmo cliente).
// Uso: node scripts/seed-usinagem-amarrado.mjs  (usa DATABASE_URL do .env)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const SEED_USER = "seed@local";

// RNG determinístico p/ seed reproduzível
let s = 12345;
const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rand() * a.length)];
const nDig = (n) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join("");
const dinheiro = (v) => Number(v).toFixed(2);

function dataHojeSP(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  return p.replace(/-/g, "");
}
async function reservarNumero(tx, tipo) {
  const dia = dataHojeSP();
  const r = await tx.$queryRaw`
    INSERT INTO contador_diario (id, tipo, data, ultimo)
    VALUES (${randomUUID()}, ${tipo}, ${dia}, 1)
    ON CONFLICT (tipo, data)
    DO UPDATE SET ultimo = contador_diario.ultimo + 1
    RETURNING ultimo`;
  return `${tipo}-${dia}-${String(r[0].ultimo).padStart(3, "0")}`;
}
const descOS = (c, d) => `Ordem de serviço - ${c ?? ""}${d ? ` - ${d}` : ""}`.slice(0, 255);
const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(9 + Math.floor(rand() * 9), Math.floor(rand() * 60), 0, 0); return d; };

const CLIENTES = [
  ["Metalúrgica Ferraz Ltda", "Osasco"], ["Auto Peças Rondon Ltda", "Barueri"],
  ["Torno & Fresa Andaluz ME", "Carapicuíba"], ["Indústria PlastBem S.A.", "São Paulo"],
  ["Serralheria Irmãos Costa", "Guarulhos"], ["Mecânica Diesel Forte Ltda", "Cotia"],
  ["Usinagem Precisão Itapevi", "Itapevi"], ["Ferramentaria Corte Fino", "Jandira"],
  ["Metal Leve Horizonte Ltda", "Osasco"], ["Retífica Central do Motor", "São Paulo"],
  ["Caldeiraria Peso Pesado SA", "Barueri"], ["Estamparia Matriz Certa", "Guarulhos"],
  ["CNC Titanium Parts Ltda", "Cotia"], ["Trefilação Fio Forte ME", "Osasco"],
  ["Montagem Industrial Alicerce", "São Paulo"], ["Fundição Ferro & Fogo", "Itapevi"],
  ["Hidráulica Pressão Total", "Barueri"], ["Pneumática Ar Comprimido", "Carapicuíba"],
  ["Manutenção Agrícola Boa Vista", "Cotia"], ["Oficina Eixo & Rolamento", "Jandira"],
  ["Laser Corte Prisma Ltda", "São Paulo"], ["Dobra & solda Galvano", "Guarulhos"],
  ["Bronze & Buchas Comercial", "Osasco"], ["Aço Inox Serra Corte", "Barueri"],
  ["Fresamento Nano Parts ME", "Itapevi"], ["Tornearia do Zé Ltda", "Cotia"],
  ["Peças Trator Terra Forte", "São Paulo"], ["Solda TIG Elite Ltda", "Osasco"],
  ["Balanceamento Rotor Fly", "Guarulhos"], ["Matriz & Estampo Estrela", "Jandira"],
];
const SERVICOS = [
  "Torneamento CNC de eixo em aço SAE 1020 Ø80x450mm",
  "Fresamento de chapa de alumínio 6061 500x300mm",
  "Solda MIG em estrutura metálica de bancada industrial",
  "Retífica cilíndrica de virabrequim diesel",
  "Furação e rosqueamento M12 em flange de aço carbono",
  "Corte a laser de chapa inox 304 2mm — lote 50 peças",
  "Usinagem de bucha de bronze TM23 Ø60x80mm",
  "Balanceamento dinâmico de rotor de exaustor",
  "Recuperação de rosca danificada em bloco de motor",
  "Dobra de chapa galvanizada 1,5mm — carenagem",
  "Torneamento de polia em ferro fundido GG25",
  "Ajuste e afiação de matriz de estampo progressiva",
  "Mandrilhamento de mancal em ferro fundido",
  "Fresamento de rasgos de chaveta em eixo ranhurado",
  "Solda TIG em tubulação inox sanitária Ø2 polegadas",
  "Retífica plana de placa base de molde",
  "Rosqueamento interno NPT 1/2 em conexão hidráulica",
  "Usinagem de engrenagem helicoidal módulo 3",
  "Corte a plasma de chapa carbono 1/4 — suporte",
  "Polimento espelhado de molde de injeção plástica",
];
const PAGAMENTOS = ["PIX", "PIX", "PIX", "DINHEIRO", "TRANSFERENCIA_BANCARIA", "CARTAO_DE_CREDITO", "CARTAO_DE_DEBITO", "BOLETO_BANCARIO_30", "BOLETO_BANCARIO_60"];
const CIDADES = { "Osasco": ["Centro", "Vila Yara"], "Barueri": ["Alphaville", "Jardim Silveira"], "Carapicuíba": ["Centro", "Vila Cretti"], "São Paulo": ["Lapa", "Barra Funda"], "Guarulhos": ["Centro", "Vila Galvão"], "Cotia": ["Granja Viana", "Centro"], "Itapevi": ["Centro", "Amador Bueno"], "Jandira": ["Centro", "Vila Eunice"] };

async function main() {
  console.log("Criando 30 clientes...");
  const cliCriados = [];
  for (let i = 0; i < CLIENTES.length; i++) {
    const [nome, cidade] = CLIENTES[i];
    const pj = i % 3 !== 2;
    const doc = pj ? nDig(14) : nDig(11);
    const email = `contato.${nome.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 30)}${i}@usinagem.local`;
    const bairros = CIDADES[cidade] ?? ["Centro"];
    const criado = await prisma.$transaction(async (tx) => {
      const c = await tx.cliente.create({
        data: {
          nome, documento: doc,
          telefone: `11 3${nDig(3)}-${nDig(4)}`, celular: `11 9${nDig(4)}-${nDig(4)}`,
          email, endereco: `Rua das Usinas, ${100 + i * 7}`, cidade,
          bairro: pick(bairros), cep: `06${nDig(2)}${i.toString().padStart(2, "0")}-${nDig(3)}`,
        },
      });
      await tx.auditoria.create({ data: { usuario: SEED_USER, acao: "CRIAR", entidade: "CLIENTE", entidadeId: c.id, descricao: c.nome.slice(0, 500) } });
      return c;
    });
    cliCriados.push(criado);
    if ((i + 1) % 10 === 0) console.log(`... ${i + 1}/30 clientes`);
  }

  console.log("Criando 100 OS + caixa vinculado...");
  const osCriadas = [];
  for (let i = 0; i < 100; i++) {
    const cli = cliCriados[i % cliCriados.length]; // round-robin: todo cliente tem OS
    const material = +(50 + rand() * 1800).toFixed(2);
    const mao = +(150 + rand() * 4500).toFixed(2);
    const preco = +(material + mao).toFixed(2);
    const data = diasAtras(Math.floor(rand() * 120));
    const os = await prisma.$transaction(async (tx) => {
      const numero = await reservarNumero(tx, "OS");
      const o = await tx.ordemServico.create({
        data: {
          numero, cliente: cli.nome, preco: dinheiro(preco), descricao: pick(SERVICOS),
          data, material: dinheiro(material), maoDeObra: dinheiro(mao),
          formaDePagamento: pick(PAGAMENTOS), criadoPor: SEED_USER, atualizadoPor: SEED_USER,
        },
      });
      await tx.transacoesCaixa.create({
        data: {
          data, descricao: descOS(o.cliente, o.descricao), categorias: "SERVICOS",
          tipo: "ENTRADA", valor: dinheiro(preco), ordemServicoId: o.id,
          criadoPor: SEED_USER, atualizadoPor: SEED_USER,
        },
      });
      await tx.auditoria.create({ data: { usuario: SEED_USER, acao: "CRIAR", entidade: "ORDEM_SERVICO", entidadeId: o.id, descricao: `${o.cliente} — ${o.descricao}`.slice(0, 500) } });
      return o;
    });
    osCriadas.push(os);
    if ((i + 1) % 25 === 0) console.log(`... ${i + 1}/100 OS`);
  }

  console.log("Criando 30 orçamentos (1 por cliente, 10 convertidos)...");
  // agrupa OS por cliente p/ vincular APROVADO no mesmo cliente
  const osPorCliente = new Map();
  for (const o of osCriadas) {
    if (!osPorCliente.has(o.cliente)) osPorCliente.set(o.cliente, []);
    osPorCliente.get(o.cliente).push(o);
  }
  let nOrc = 0;
  for (let j = 0; j < cliCriados.length; j++) {
    const cli = cliCriados[j];
    let status = "PENDENTE", validade = new Date(Date.now() + 15 * 864e5), ordemServicoId = null;
    if (j >= 10 && j < 20) status = "APROVADO";
    else if (j >= 20 && j < 25) { status = "RECUSADO"; validade = new Date(Date.now() + 15 * 864e5); }
    else if (j >= 25) { status = "EXPIRADO"; validade = new Date(Date.now() - 20 * 864e5); }
    if (status === "APROVADO") {
      const lista = osPorCliente.get(cli.nome) ?? [];
      ordemServicoId = lista[0]?.id ?? null; // OS do MESMO cliente
    }
    const material = +(50 + rand() * 1500).toFixed(2);
    const mao = +(150 + rand() * 4000).toFixed(2);
    const data = diasAtras(Math.floor(rand() * 60));
    await prisma.$transaction(async (tx) => {
      const numero = await reservarNumero(tx, "ORC");
      const o = await tx.orcamento.create({
        data: {
          numero, cliente: cli.nome, preco: dinheiro(material + mao), descricao: pick(SERVICOS),
          data, material: dinheiro(material), maoDeObra: dinheiro(mao),
          formaDePagamento: pick(PAGAMENTOS), status, validade,
          ordemServicoId, criadoPor: SEED_USER, atualizadoPor: SEED_USER,
        },
      });
      await tx.auditoria.create({ data: { usuario: SEED_USER, acao: "CRIAR", entidade: "ORCAMENTO", entidadeId: o.id, descricao: `${o.cliente} — ${o.descricao}`.slice(0, 500) } });
      if (status === "APROVADO" && ordemServicoId) {
        await tx.auditoria.create({ data: { usuario: SEED_USER, acao: "CONVERTER", entidade: "ORCAMENTO", entidadeId: o.id, descricao: `${o.cliente} — virou OS`.slice(0, 500) } });
      }
    });
    nOrc++;
    if (nOrc % 10 === 0) console.log(`... ${nOrc}/30 orçamentos`);
  }

  const resumo = {
    clientes: await prisma.cliente.count(),
    os: await prisma.ordemServico.count(),
    orcamentos: await prisma.orcamento.count(),
    caixaTotal: await prisma.transacoesCaixa.count(),
    caixaVinculado: await prisma.transacoesCaixa.count({ where: { ordemServicoId: { not: null } } }),
  };
  console.log("SEED OK:", JSON.stringify(resumo, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
