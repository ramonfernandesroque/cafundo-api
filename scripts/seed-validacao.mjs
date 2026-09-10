// Seed de validação cruzada: 90 OS diretas + 50 orçamentos distribuídos
// entre TODOS os clientes cadastrados (round-robin garante >=1 registro
// por cliente), depois converte 10 orçamentos em OS (amarração completa:
// APROVADO + ordemServicoId + caixa). Final: 100 OS + 50 ORC.
// Uso: node scripts/seed-validacao.mjs
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const API = process.env.API_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();

const secret = readFileSync(".env", "utf8").match(/SECRET_KEY=(.*)/)[1].trim();
const TOKEN = execSync(
  `node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:'seed',email:'seed@local',role:'ADMIN'},process.argv[1],{expiresIn:'30m'}))" ${secret}`,
  { encoding: "utf8" }
).trim();

let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const SERVICOS = [
  "Torneamento de eixo em aço 1020", "Fresamento de chapa de alumínio",
  "Solda MIG em estrutura metálica", "Retífica de virabrequim",
  "Furação e rosqueamento de flange", "Corte a plasma de chapa 1/4",
  "Usinagem de bucha de bronze", "Balanceamento de rotor",
  "Recuperação de rosca em bloco", "Dobra de chapa galvanizada",
  "Torneamento de polia em ferro fundido", "Ajuste de matriz de estampo",
];
const PAGAMENTOS = ["PIX", "DINHEIRO", "TRANSFERENCIA_BANCARIA", "CARTAO_DE_CREDITO", "CARTAO_DE_DEBITO", "BOLETO_BANCARIO_30"];

const diasAtras = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + Math.floor(rand() * 9), Math.floor(rand() * 60), 0, 0);
  return d.toISOString();
};

function montar(cliente, i) {
  const material = +(rand() * 800).toFixed(2);
  const mao = +(200 + rand() * 2500).toFixed(2);
  return {
    cliente,
    preco: +(material + mao).toFixed(2),
    descricao: `${pick(SERVICOS)} (#${i + 1})`,
    data: diasAtras(Math.floor(rand() * 15)),
    material: String(material),
    maoDeObra: String(mao),
    formaDePagamento: pick(PAGAMENTOS),
  };
}

async function post(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

const clientes = (await prisma.cliente.findMany({ select: { nome: true }, orderBy: { nome: "asc" } })).map((c) => c.nome);
console.log(`Distribuindo entre ${clientes.length} clientes...`);

// Round-robin: i-ésimo registro vai para clientes[i % N] => cobertura total.
let okOS = 0, okORC = 0;
const orcIds = [];
for (let i = 0; i < 90; i++) {
  await post("/api/ordemServico", montar(clientes[i % clientes.length], i));
  okOS += 1;
}
for (let i = 0; i < 50; i++) {
  const validade = new Date();
  validade.setDate(validade.getDate() + 15);
  const orc = await post("/api/orcamento", {
    ...montar(clientes[(i * 2 + 1) % clientes.length], 90 + i),
    validade: validade.toISOString(),
    status: "PENDENTE",
  });
  orcIds.push(orc.id);
  okORC += 1;
}
console.log(`Criados: ${okOS} OS + ${okORC} orçamentos. Convertendo 10...`);

let convertidas = 0;
for (let i = 0; i < orcIds.length && convertidas < 10; i += 5) {
  const r = await post("/api/orcamento/convert", { id: orcIds[i] });
  if (r.ordemServico?.numero) convertidas += 1;
}
console.log(`Convertidos: ${convertidas} orçamentos -> OS.`);
await prisma.$disconnect();
