/*
  Warnings:

  - You are about to drop the `Cliente` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NovoServico` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Servico` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Cliente";

-- DropTable
DROP TABLE "NovoServico";

-- DropTable
DROP TABLE "Servico";

-- CreateTable
CREATE TABLE "ordemServico" (
    "id" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "preco" DECIMAL(65,30) NOT NULL,
    "descricao" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "maoDeObra" DECIMAL(65,30) NOT NULL,
    "material" DECIMAL(65,30) NOT NULL,
    "formaDePagamento" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "ordemServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servico" (
    "id" TEXT NOT NULL,
    "servico" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valorTotal" DECIMAL(65,30) NOT NULL,
    "material" DECIMAL(65,30) NOT NULL,
    "maoDeObra" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "cep" TEXT NOT NULL,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cliente_documento_key" ON "cliente"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_email_key" ON "cliente"("email");
