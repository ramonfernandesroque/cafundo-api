// Seed de massa (uso pontual): cria 100 OS + 100 orçamentos realistas via
// API (exercita numeração, caixa e auditoria), distribuídos nos últimos
// 10 dias para as sequências diárias ficarem verossímeis.
// Uso: API_URL=http://localhost:3000 node scripts/seed-massa.mjs
import { readFileSync } from "fs";
import { execSync } from "child_process";

const API = process.env.API_URL ?? "http://localhost:3000";

// Token forjado localmente com a SECRET_KEY do .env (ambiente de dev).
const secret = readFileSync(".env", "utf8").match(/SECRET_KEY=(.*)/)[1].trim();
const jwtCli = "node -e \"const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:'seed',email:'seed@local',role:'ADMIN'},process.argv[1],{expiresIn:'30m'}))\"";
const TOKEN = execSync(`${jwtCli} ${secret}`, { encoding: "utf8" }).trim();

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const num = (n) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join("");

const CLIENTES = [
  "Metalúrgica Ferraz Ltda", "Auto Peças Rondon", "João Carlos Mendes",
  "Transportadora Andaluz", "Padaria Pão Dourado", "Marcos Vinícius Prado",
  "Indústria PlastBem", "Oficina do Zé", "Ana Paula Ribeiro",
  "Construtora Alicerce", "Paulo Henrique Duarte", "Fazenda Boa Vista",
  "Serralheria Irmãos Costa", "Luciana Ferreira", "Mecânica Diesel Forte",
  "Supermercado Preço Bom", "Roberto Almeida Santos", "Gráfica Central",
  "Clínica OdontoVida", "Fernanda Lima", "Torrefação Café Serra",
  "Vidraçaria Prisma", "Carlos Eduardo Nogueira", "Malharia Estrela",
  "Padaria Trigo Real", "Juliana Castro", "Fábrica de Móveis Horizonte",
];
const CIDADES = ["Osasco", "Barueri", "Carapicuíba", "São Paulo", "Guarulhos", "Cotia", "Itapevi", "Jandira"];
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
  d.setHours(10 + Math.floor(rand() * 8), Math.floor(rand() * 60), 0, 0);
  return d.toISOString();
};

function montar(i) {
  const pf = rand() < 0.45;
  const material = +(rand() * 800).toFixed(2);
  const mao = +(200 + rand() * 2500).toFixed(2);
  return {
    cliente: `${pick(CLIENTES)}${i >= CLIENTES.length ? ` ${Math.floor(i / CLIENTES.length) + 1}` : ""}`,
    preco: +(material + mao).toFixed(2),
    descricao: pick(SERVICOS),
    data: diasAtras(Math.floor(rand() * 10)),
    material: String(material),
    maoDeObra: String(mao),
    formaDePagamento: pick(PAGAMENTOS),
    documento: pf ? num(11) : num(14),
    cidade: pick(CIDADES),
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

let okOS = 0, okORC = 0;
for (let i = 0; i < 100; i++) {
  const d = montar(i);
  const { documento, cidade, ...os } = d;
  await post("/api/ordemServico", os);
  okOS += 1;
  const validade = new Date();
  validade.setDate(validade.getDate() + 15);
  await post("/api/orcamento", { ...os, validade: validade.toISOString(), status: "PENDENTE" });
  okORC += 1;
  if ((i + 1) % 25 === 0) console.log(`... ${i + 1}/100 pares criados`);
}
console.log(`Seed concluído: ${okOS} OS + ${okORC} orçamentos.`);
