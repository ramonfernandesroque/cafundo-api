// lib/prisma.ts
// Mantido por compatibilidade: re-exporta o singleton de lib/prisma.ts
// para não criar uma segunda conexão.
import prisma from "../lib/prisma";

// Exporta a instância para ser usada em outras partes do projeto
export default prisma
