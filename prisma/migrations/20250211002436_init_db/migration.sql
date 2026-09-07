/*
  Warnings:

  - The values [CARTAO_CREDITO,CARTAO_DEBITO] on the enum `ordemServicoformaDePagamento` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ordemServicoformaDePagamento_new" AS ENUM ('CARTAO_DE_CREDITO', 'CARTAO_DE_DEBITO', 'TRANSFERENCIA_BANCARIA', 'BOLETO_BANCARIO', 'BOLETO_BANCARIO_10', 'BOLETO_BANCARIO_30', 'BOLETO_BANCARIO_60', 'BOLETO_BANCARIO_90', 'DINHEIRO', 'PIX', 'OUTROS');
ALTER TABLE "ordemServico" ALTER COLUMN "formaDePagamento" TYPE "ordemServicoformaDePagamento_new" USING ("formaDePagamento"::text::"ordemServicoformaDePagamento_new");
ALTER TYPE "ordemServicoformaDePagamento" RENAME TO "ordemServicoformaDePagamento_old";
ALTER TYPE "ordemServicoformaDePagamento_new" RENAME TO "ordemServicoformaDePagamento";
DROP TYPE "ordemServicoformaDePagamento_old";
COMMIT;
