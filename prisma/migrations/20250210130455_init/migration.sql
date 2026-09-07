/*
  Warnings:

  - You are about to alter the column `preco` on the `ordemServico` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `maoDeObra` on the `ordemServico` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `material` on the `ordemServico` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to drop the `PaymentMethod` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentTerm` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServiceOrder` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `formaDePagamento` on the `ordemServico` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ordemServicoformaDePagamento" AS ENUM ('CARTAO_CREDITO', 'CARTAO_DEBITO', 'TRANSFERENCIA_BANCARIA', 'BOLETO_BANCARIO', 'BOLETO_BANCARIO_10', 'BOLETO_BANCARIO_30', 'BOLETO_BANCARIO_60', 'BOLETO_BANCARIO_90', 'DINHEIRO', 'PIX', 'OTHER');

-- DropForeignKey
ALTER TABLE "PaymentTerm" DROP CONSTRAINT "PaymentTerm_paymentMethodId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceOrder" DROP CONSTRAINT "ServiceOrder_paymentMethodId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceOrder" DROP CONSTRAINT "ServiceOrder_paymentTermId_fkey";

-- AlterTable
ALTER TABLE "ordemServico" ALTER COLUMN "preco" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "maoDeObra" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "material" SET DATA TYPE DECIMAL(10,2),
DROP COLUMN "formaDePagamento",
ADD COLUMN     "formaDePagamento" "ordemServicoformaDePagamento" NOT NULL;

-- DropTable
DROP TABLE "PaymentMethod";

-- DropTable
DROP TABLE "PaymentTerm";

-- DropTable
DROP TABLE "ServiceOrder";
