/*
  Warnings:

  - The values [OTHER] on the enum `ordemServicoformaDePagamento` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `maoDeObra` to the `ordemServico` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ordemServicoformaDePagamento_new" AS ENUM ('CARTAO_CREDITO', 'CARTAO_DEBITO', 'TRANSFERENCIA_BANCARIA', 'BOLETO_BANCARIO', 'BOLETO_BANCARIO_10', 'BOLETO_BANCARIO_30', 'BOLETO_BANCARIO_60', 'BOLETO_BANCARIO_90', 'DINHEIRO', 'PIX', 'OUTROS');
ALTER TABLE "ordemServico" ALTER COLUMN "formaDePagamento" TYPE "ordemServicoformaDePagamento_new" USING ("formaDePagamento"::text::"ordemServicoformaDePagamento_new");
ALTER TYPE "ordemServicoformaDePagamento" RENAME TO "ordemServicoformaDePagamento_old";
ALTER TYPE "ordemServicoformaDePagamento_new" RENAME TO "ordemServicoformaDePagamento";
DROP TYPE "ordemServicoformaDePagamento_old";
COMMIT;

-- AlterTable
ALTER TABLE "ordemServico" ADD COLUMN     "maoDeObra" DECIMAL(10,2) NOT NULL;
