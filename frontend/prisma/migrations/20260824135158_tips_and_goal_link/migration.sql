-- AlterTable
ALTER TABLE "SavingsGoal" ADD COLUMN     "tipId" TEXT;

-- AlterTable
ALTER TABLE "Tip" ADD COLUMN     "estimatedSavingsFcfa" INTEGER;

-- CreateIndex
CREATE INDEX "SavingsGoal_tipId_idx" ON "SavingsGoal"("tipId");

-- AddForeignKey
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "Tip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
