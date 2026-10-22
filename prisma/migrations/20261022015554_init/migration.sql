-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "department_id" TEXT,
    "employee_code" TEXT,
    "full_name" TEXT NOT NULL,
    "nickname" TEXT,
    "phone" TEXT,
    "national_id" TEXT,
    "address" TEXT,
    "date_of_birth" TEXT,
    "email" TEXT,
    "employment_status" TEXT NOT NULL DEFAULT 'active',
    "hired_on" TEXT,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "members_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "application_no" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "requested_amount_satang" BIGINT NOT NULL,
    "requested_installments" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "decision_note" TEXT,
    "submitted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "loan_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_applications_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "application_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size_bytes" BIGINT,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_contracts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contract_no" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "principal_satang" BIGINT NOT NULL,
    "monthly_interest_rate" REAL NOT NULL DEFAULT 0,
    "installment_count" INTEGER NOT NULL,
    "signed_on" TEXT,
    "first_due_on" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "loan_contracts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "loan_contracts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contract_id" TEXT NOT NULL,
    "installment_no" INTEGER NOT NULL,
    "due_on" TEXT NOT NULL,
    "principal_due_satang" BIGINT NOT NULL,
    "interest_due_satang" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "loan_contracts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receipt_no" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "amount_satang" BIGINT NOT NULL,
    "paid_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "reference_no" TEXT,
    "note" TEXT,
    "recorded_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "loan_contracts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "payment_id" TEXT NOT NULL,
    "installment_id" TEXT NOT NULL,
    "amount_satang" BIGINT NOT NULL,

    PRIMARY KEY ("payment_id", "installment_id"),
    CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_allocations_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "organization_settings" (
    "organization_id" TEXT NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,

    PRIMARY KEY ("organization_id", "setting_key"),
    CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "company_ledger_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "import_key" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "occurred_at" DATETIME NOT NULL,
    "transaction_date" TEXT NOT NULL,
    "transaction_time" TEXT,
    "transaction_no" TEXT,
    "headquarters_code" TEXT,
    "branch_code" TEXT,
    "entry_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "member_id" TEXT,
    "related_party" TEXT,
    "payment_channel" TEXT,
    "reference_no" TEXT,
    "source_label" TEXT,
    "base_amount_satang" BIGINT NOT NULL DEFAULT 0,
    "vat_percent" REAL,
    "vat_amount_satang" BIGINT NOT NULL DEFAULT 0,
    "withholding_percent" REAL,
    "withholding_amount_satang" BIGINT NOT NULL DEFAULT 0,
    "net_income_satang" BIGINT NOT NULL DEFAULT 0,
    "net_expense_satang" BIGINT NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_ledger_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "company_ledger_entries_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "old_values_json" TEXT,
    "new_values_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_name_key" ON "departments"("organization_id", "name");

-- CreateIndex
CREATE INDEX "members_department_id_idx" ON "members"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_organization_id_employee_code_key" ON "members"("organization_id", "employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_application_no_key" ON "loan_applications"("application_no");

-- CreateIndex
CREATE INDEX "loan_applications_member_id_submitted_at_idx" ON "loan_applications"("member_id", "submitted_at" DESC);

-- CreateIndex
CREATE INDEX "loan_applications_status_submitted_at_idx" ON "loan_applications"("status", "submitted_at" DESC);

-- CreateIndex
CREATE INDEX "loan_documents_application_id_idx" ON "loan_documents"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_contracts_contract_no_key" ON "loan_contracts"("contract_no");

-- CreateIndex
CREATE UNIQUE INDEX "loan_contracts_application_id_key" ON "loan_contracts"("application_id");

-- CreateIndex
CREATE INDEX "loan_contracts_member_id_status_idx" ON "loan_contracts"("member_id", "status");

-- CreateIndex
CREATE INDEX "installments_due_on_status_idx" ON "installments"("due_on", "status");

-- CreateIndex
CREATE UNIQUE INDEX "installments_contract_id_installment_no_key" ON "installments"("contract_id", "installment_no");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receipt_no_key" ON "payments"("receipt_no");

-- CreateIndex
CREATE INDEX "payments_contract_id_paid_at_idx" ON "payments"("contract_id", "paid_at" DESC);

-- CreateIndex
CREATE INDEX "payment_allocations_installment_id_idx" ON "payment_allocations"("installment_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_ledger_entries_import_key_key" ON "company_ledger_entries"("import_key");

-- CreateIndex
CREATE INDEX "company_ledger_entries_organization_id_occurred_at_idx" ON "company_ledger_entries"("organization_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "company_ledger_entries_member_id_occurred_at_idx" ON "company_ledger_entries"("member_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "company_ledger_entries_organization_id_transaction_no_key" ON "company_ledger_entries"("organization_id", "transaction_no");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at" DESC);
