-- Numeração humanizada diária: OS-YYYYMMDD-SEQ / ORC-YYYYMMDD-SEQ
-- + tabela de contador diário (reserva atômica via ON CONFLICT).

-- AlterTable
ALTER TABLE "orcamento" ADD COLUMN     "numero" TEXT;

-- AlterTable
ALTER TABLE "ordemServico" ADD COLUMN     "numero" TEXT;

-- CreateTable
CREATE TABLE "contador_diario" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contador_diario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contador_diario_tipo_data_key" ON "contador_diario"("tipo", "data");

-- CreateIndex
CREATE UNIQUE INDEX "orcamento_numero_key" ON "orcamento"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "ordemServico_numero_key" ON "ordemServico"("numero");
