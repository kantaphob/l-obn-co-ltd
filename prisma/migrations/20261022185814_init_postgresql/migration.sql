-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BorrowerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('IDENTITY', 'ADDRESS', 'INCOME');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LoanApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LoanContractStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'PAID_OFF', 'DEFAULTED', 'RESTRUCTURED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('UPCOMING', 'DUE', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'QR_PAYMENT', 'DIRECT_DEBIT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NATIONAL_ID', 'HOUSE_REGISTRATION', 'PAYSLIP', 'BANK_STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PRIVACY_NOTICE', 'CREDIT_CHECK', 'TERMS_AND_CONDITIONS', 'ELECTRONIC_SIGNATURE', 'DATA_SHARING');

-- CreateEnum
CREATE TYPE "ConsentDecision" AS ENUM ('ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "acccode" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_settings" (
    "id" SERIAL NOT NULL,
    "organization_id" TEXT NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_sequences" (
    "id" SERIAL NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'default',
    "series" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'ALL',
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lenders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lender_no" TEXT NOT NULL,
    "national_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "name_en" TEXT,
    "date_of_birth" TEXT,
    "gender" TEXT,
    "address" TEXT,
    "house_number" TEXT,
    "soi" TEXT,
    "road" TEXT,
    "subdistrict_code" TEXT,
    "subdistrict" TEXT,
    "district_code" TEXT,
    "district" TEXT,
    "province_code" TEXT,
    "province" TEXT,
    "postcode" TEXT,
    "card_issuer" TEXT,
    "card_issued_on" TEXT,
    "card_expires_on" TEXT,
    "photo_data" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "kyc_verified_at" TIMESTAMP(3),
    "kyc_method" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_profiles" (
    "id" SERIAL NOT NULL,
    "borrower_no" TEXT,
    "nickname" TEXT,
    "department_name" TEXT,
    "userId" INTEGER,
    "nationalId" TEXT,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "name_en" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "house_number" TEXT,
    "soi" TEXT,
    "road" TEXT,
    "subdistrict_code" TEXT,
    "province" TEXT,
    "district_code" TEXT,
    "district" TEXT,
    "province_code" TEXT,
    "subdistrict" TEXT,
    "postcode" TEXT,
    "card_issuer" TEXT,
    "card_issued_on" TEXT,
    "card_expires_on" TEXT,
    "photo_data" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "kyc_verified_at" TIMESTAMP(3),
    "kyc_method" TEXT,
    "status" "BorrowerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrower_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_verifications" (
    "id" SERIAL NOT NULL,
    "borrowerId" INTEGER NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewerUserId" INTEGER,
    "rejectionReason" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrower_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" SERIAL NOT NULL,
    "applicationNo" TEXT NOT NULL,
    "borrowerId" INTEGER NOT NULL,
    "status" "LoanApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedAmountSatang" BIGINT NOT NULL,
    "approvedAmountSatang" BIGINT,
    "requestedTermMonths" INTEGER NOT NULL,
    "purpose" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_contracts" (
    "id" SERIAL NOT NULL,
    "contractNo" TEXT NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "borrowerId" INTEGER NOT NULL,
    "status" "LoanContractStatus" NOT NULL DEFAULT 'DRAFT',
    "principalSatang" BIGINT NOT NULL,
    "interestRateBps" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "repayment_method" TEXT NOT NULL DEFAULT 'OTHER',
    "signedAt" TIMESTAMP(3),
    "disbursedAt" TIMESTAMP(3),
    "maturityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_installments" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "principalDueSatang" BIGINT NOT NULL,
    "interestDueSatang" BIGINT NOT NULL,
    "feeDueSatang" BIGINT NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'UPCOMING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_payments" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "amountSatang" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "reference" TEXT,
    "recordedById" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_payment_allocations" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "installmentId" INTEGER NOT NULL,
    "amountSatang" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_ledger_entries" (
    "id" TEXT NOT NULL,
    "import_key" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "transaction_date" TEXT NOT NULL,
    "transaction_time" TEXT NOT NULL,
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
    "base_amount_satang" BIGINT NOT NULL,
    "vat_percent" DOUBLE PRECISION,
    "vat_amount_satang" BIGINT NOT NULL DEFAULT 0,
    "withholding_percent" DOUBLE PRECISION,
    "withholding_amount_satang" BIGINT NOT NULL DEFAULT 0,
    "net_income_satang" BIGINT NOT NULL DEFAULT 0,
    "net_expense_satang" BIGINT NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_documents" (
    "id" SERIAL NOT NULL,
    "borrowerId" INTEGER NOT NULL,
    "applicationId" INTEGER,
    "verificationId" INTEGER,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrower_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" SERIAL NOT NULL,
    "borrowerId" INTEGER NOT NULL,
    "type" "ConsentType" NOT NULL,
    "decision" "ConsentDecision" NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "evidenceHash" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provinces" (
    "id" SERIAL NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" SERIAL NOT NULL,
    "province_id" INTEGER NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subdistricts" (
    "id" SERIAL NOT NULL,
    "district_id" INTEGER NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "postcode" TEXT,

    CONSTRAINT "subdistricts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_acccode_key" ON "users"("acccode");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_settings_organization_id_setting_key_key" ON "organization_settings"("organization_id", "setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_scope_series_period_key" ON "number_sequences"("scope", "series", "period");

-- CreateIndex
CREATE INDEX "lenders_organization_id_full_name_idx" ON "lenders"("organization_id", "full_name");

-- CreateIndex
CREATE UNIQUE INDEX "lenders_organization_id_lender_no_key" ON "lenders"("organization_id", "lender_no");

-- CreateIndex
CREATE UNIQUE INDEX "lenders_organization_id_national_id_key" ON "lenders"("organization_id", "national_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permission_key" ON "role_permissions"("roleId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_email_key" ON "user_profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_phone_key" ON "user_profiles"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_profiles_borrower_no_key" ON "borrower_profiles"("borrower_no");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_profiles_userId_key" ON "borrower_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_profiles_nationalId_key" ON "borrower_profiles"("nationalId");

-- CreateIndex
CREATE INDEX "borrower_profiles_status_idx" ON "borrower_profiles"("status");

-- CreateIndex
CREATE INDEX "borrower_profiles_phone_idx" ON "borrower_profiles"("phone");

-- CreateIndex
CREATE INDEX "borrower_verifications_borrowerId_type_status_idx" ON "borrower_verifications"("borrowerId", "type", "status");

-- CreateIndex
CREATE INDEX "borrower_verifications_reviewerUserId_idx" ON "borrower_verifications"("reviewerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_applicationNo_key" ON "loan_applications"("applicationNo");

-- CreateIndex
CREATE INDEX "loan_applications_borrowerId_status_idx" ON "loan_applications"("borrowerId", "status");

-- CreateIndex
CREATE INDEX "loan_applications_status_createdAt_idx" ON "loan_applications"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "loan_contracts_contractNo_key" ON "loan_contracts"("contractNo");

-- CreateIndex
CREATE UNIQUE INDEX "loan_contracts_applicationId_key" ON "loan_contracts"("applicationId");

-- CreateIndex
CREATE INDEX "loan_contracts_borrowerId_status_idx" ON "loan_contracts"("borrowerId", "status");

-- CreateIndex
CREATE INDEX "loan_installments_dueAt_status_idx" ON "loan_installments"("dueAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "loan_installments_contractId_installmentNo_key" ON "loan_installments"("contractId", "installmentNo");

-- CreateIndex
CREATE UNIQUE INDEX "loan_payments_receiptNo_key" ON "loan_payments"("receiptNo");

-- CreateIndex
CREATE INDEX "loan_payments_contractId_status_paidAt_idx" ON "loan_payments"("contractId", "status", "paidAt");

-- CreateIndex
CREATE INDEX "loan_payments_recordedById_idx" ON "loan_payments"("recordedById");

-- CreateIndex
CREATE INDEX "loan_payment_allocations_installmentId_idx" ON "loan_payment_allocations"("installmentId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_payment_allocations_paymentId_installmentId_key" ON "loan_payment_allocations"("paymentId", "installmentId");

-- CreateIndex
CREATE UNIQUE INDEX "company_ledger_entries_import_key_key" ON "company_ledger_entries"("import_key");

-- CreateIndex
CREATE INDEX "company_ledger_entries_organization_id_occurred_at_idx" ON "company_ledger_entries"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "company_ledger_entries_organization_id_entry_type_transacti_idx" ON "company_ledger_entries"("organization_id", "entry_type", "transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_documents_storageKey_key" ON "borrower_documents"("storageKey");

-- CreateIndex
CREATE INDEX "borrower_documents_borrowerId_type_status_idx" ON "borrower_documents"("borrowerId", "type", "status");

-- CreateIndex
CREATE INDEX "borrower_documents_applicationId_idx" ON "borrower_documents"("applicationId");

-- CreateIndex
CREATE INDEX "borrower_documents_verificationId_idx" ON "borrower_documents"("verificationId");

-- CreateIndex
CREATE INDEX "consent_records_borrowerId_type_recordedAt_idx" ON "consent_records"("borrowerId", "type", "recordedAt");

-- CreateIndex
CREATE INDEX "districts_province_id_name_th_idx" ON "districts"("province_id", "name_th");

-- CreateIndex
CREATE INDEX "subdistricts_district_id_name_th_idx" ON "subdistricts"("district_id", "name_th");

-- CreateIndex
CREATE INDEX "subdistricts_postcode_idx" ON "subdistricts"("postcode");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_profiles" ADD CONSTRAINT "borrower_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_verifications" ADD CONSTRAINT "borrower_verifications_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_verifications" ADD CONSTRAINT "borrower_verifications_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_contracts" ADD CONSTRAINT "loan_contracts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_contracts" ADD CONSTRAINT "loan_contracts_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "loan_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "loan_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payment_allocations" ADD CONSTRAINT "loan_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "loan_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payment_allocations" ADD CONSTRAINT "loan_payment_allocations_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "loan_installments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_documents" ADD CONSTRAINT "borrower_documents_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_documents" ADD CONSTRAINT "borrower_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_documents" ADD CONSTRAINT "borrower_documents_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "borrower_verifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subdistricts" ADD CONSTRAINT "subdistricts_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

