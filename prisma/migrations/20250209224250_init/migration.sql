-- CreateTable
CREATE TABLE "NovoServico" (
    "id" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "preco" DECIMAL(65,30) NOT NULL,
    "descricao" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "maoDeObra" DECIMAL(65,30) NOT NULL,
    "material" DECIMAL(65,30) NOT NULL,
    "formaDePagamento" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "NovoServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servico" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valorTotal" DECIMAL(65,30) NOT NULL,
    "material" DECIMAL(65,30) NOT NULL,
    "maoDeObra" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "cep" TEXT NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_documento_key" ON "Cliente"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_email_key" ON "Cliente"("email");
