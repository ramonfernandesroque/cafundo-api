/*
  Warnings:

  - Added the required column `celular` to the `cliente` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "ordemServicoformaDePagamento" ADD VALUE 'BOLETO_BANCARIO_20';

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "celular" TEXT NOT NULL;
