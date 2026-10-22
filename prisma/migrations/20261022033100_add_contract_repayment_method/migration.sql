-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_loan_contracts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contract_no" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "principal_satang" BIGINT NOT NULL,
    "monthly_interest_rate" REAL NOT NULL DEFAULT 0,
    "installment_count" INTEGER NOT NULL,
    "repayment_method" TEXT NOT NULL DEFAULT 'payroll_deduction',
    "signed_on" TEXT,
    "first_due_on" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "loan_contracts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "loan_contracts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_loan_contracts" ("application_id", "contract_no", "created_at", "first_due_on", "id", "installment_count", "member_id", "monthly_interest_rate", "principal_satang", "signed_on", "status", "updated_at") SELECT "application_id", "contract_no", "created_at", "first_due_on", "id", "installment_count", "member_id", "monthly_interest_rate", "principal_satang", "signed_on", "status", "updated_at" FROM "loan_contracts";
DROP TABLE "loan_contracts";
ALTER TABLE "new_loan_contracts" RENAME TO "loan_contracts";
CREATE UNIQUE INDEX "loan_contracts_contract_no_key" ON "loan_contracts"("contract_no");
CREATE UNIQUE INDEX "loan_contracts_application_id_key" ON "loan_contracts"("application_id");
CREATE INDEX "loan_contracts_member_id_status_idx" ON "loan_contracts"("member_id", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
