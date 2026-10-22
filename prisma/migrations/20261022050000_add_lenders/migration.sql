CREATE TABLE "lenders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "national_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "name_en" TEXT,
    "date_of_birth" TEXT,
    "gender" TEXT,
    "address" TEXT,
    "card_issuer" TEXT,
    "card_issued_on" TEXT,
    "card_expires_on" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "lenders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "lenders_organization_id_national_id_key" ON "lenders"("organization_id", "national_id");
CREATE INDEX "lenders_organization_id_full_name_idx" ON "lenders"("organization_id", "full_name");
