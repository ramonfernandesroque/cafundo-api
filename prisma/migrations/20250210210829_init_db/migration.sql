/*
  Warnings:

  - You are about to drop the column `maoDeObra` on the `ordemServico` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ordemServico" DROP COLUMN "maoDeObra",
ALTER COLUMN "data" SET DATA TYPE DATE;
