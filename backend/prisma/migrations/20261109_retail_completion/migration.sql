-- RetailSystem additive Sri Lanka POS feature migration
-- Apply with your normal Prisma migration deployment workflow; backup database first.
CREATE TABLE IF NOT EXISTS "Customer" (
 "id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"name" TEXT NOT NULL,"phone" TEXT,"email" TEXT,"address" TEXT,"birthday" TIMESTAMP(3),"notes" TEXT,
 "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,"totalSpent" DECIMAL(12,2) NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Customer_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "Customer_businessId_name_idx" ON "Customer"("businessId","name");
CREATE INDEX IF NOT EXISTS "Customer_businessId_phone_idx" ON "Customer"("businessId","phone");
DO $ BEGIN ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");
DO $ BEGIN ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $;
CREATE TABLE IF NOT EXISTS "Expense" (
 "id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"createdById" TEXT NOT NULL,"category" TEXT NOT NULL,"description" TEXT NOT NULL,"amount" DECIMAL(12,2) NOT NULL,
 "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',"expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"reference" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "Expense_businessId_expenseDate_idx" ON "Expense"("businessId","expenseDate");
CREATE INDEX IF NOT EXISTS "Expense_businessId_category_idx" ON "Expense"("businessId","category");
DO $ BEGIN ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $;
CREATE TABLE IF NOT EXISTS "Supplier" (
 "id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"name" TEXT NOT NULL,"phone" TEXT,"email" TEXT,"address" TEXT,"notes" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "Supplier_businessId_name_idx" ON "Supplier"("businessId","name");
DO $ BEGIN ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $;
CREATE TABLE IF NOT EXISTS "Purchase" (
 "id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"supplierId" TEXT NOT NULL,"reference" TEXT,"notes" TEXT,"total" DECIMAL(12,2) NOT NULL,"receivedById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "Purchase_businessId_createdAt_idx" ON "Purchase"("businessId","createdAt");
DO $ BEGIN ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $;
DO $ BEGIN ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $;
CREATE TABLE IF NOT EXISTS "PurchaseItem" (
 "id" TEXT NOT NULL,"purchaseId" TEXT NOT NULL,"productId" TEXT NOT NULL,"productName" TEXT NOT NULL,"quantity" DECIMAL(10,2) NOT NULL,"unitCost" DECIMAL(10,2) NOT NULL,"lineTotal" DECIMAL(12,2) NOT NULL,
 CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");
DO $ BEGIN ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $;
CREATE TABLE IF NOT EXISTS "CashShift" (
 "id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"cashierId" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'OPEN',"openingCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
 "closingCash" DECIMAL(12,2),"expectedCash" DECIMAL(12,2),"variance" DECIMAL(12,2),"notes" TEXT,"openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"closedAt" TIMESTAMP(3),
 CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "CashShift_businessId_status_idx" ON "CashShift"("businessId","status");
CREATE INDEX IF NOT EXISTS "CashShift_cashierId_status_idx" ON "CashShift"("cashierId","status");
DO $ BEGIN ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $;
DO $ BEGIN ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $;
CREATE TABLE IF NOT EXISTS "SaleReturn" (
 "id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"orderId" TEXT NOT NULL,"amount" DECIMAL(12,2) NOT NULL,"reason" TEXT NOT NULL,"restocked" BOOLEAN NOT NULL DEFAULT true,"processedById" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "SaleReturn_orderId_key" ON "SaleReturn"("orderId");
CREATE INDEX IF NOT EXISTS "SaleReturn_businessId_createdAt_idx" ON "SaleReturn"("businessId","createdAt");
DO $ BEGIN ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $;
DO $ BEGIN ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $;

-- Prevent concurrent duplicate open shifts for one cashier/business.
CREATE UNIQUE INDEX IF NOT EXISTS "CashShift_one_open_per_cashier_idx" ON "CashShift"("businessId","cashierId") WHERE "status" = 'OPEN';
