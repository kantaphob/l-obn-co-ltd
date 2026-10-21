CREATE TABLE organizations (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE departments (
  id TEXT NOT NULL PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organization_id, name)
);
CREATE TABLE members (
  id TEXT NOT NULL PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  employee_code TEXT,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  employment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'inactive', 'terminated')),
  hired_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), nickname TEXT, national_id TEXT, address TEXT, date_of_birth TEXT,
  UNIQUE (organization_id, employee_code)
);
CREATE TABLE loan_applications (
  id TEXT NOT NULL PRIMARY KEY,
  application_no TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL,
  requested_amount_satang INTEGER NOT NULL CHECK (requested_amount_satang > 0),
  requested_installments INTEGER NOT NULL CHECK (requested_installments > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'needs_documents', 'approved', 'rejected', 'withdrawn')),
  note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  decision_note TEXT,
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE loan_documents (
  id TEXT NOT NULL PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes INTEGER CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE loan_contracts (
  id TEXT NOT NULL PRIMARY KEY,
  contract_no TEXT NOT NULL UNIQUE,
  application_id TEXT NOT NULL UNIQUE REFERENCES loan_applications(id) ON DELETE RESTRICT,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  principal_satang INTEGER NOT NULL CHECK (principal_satang > 0),
  monthly_interest_rate REAL NOT NULL DEFAULT 0 CHECK (monthly_interest_rate >= 0),
  installment_count INTEGER NOT NULL CHECK (installment_count > 0),
  signed_on TEXT,
  first_due_on TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paid', 'cancelled', 'defaulted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE installments (
  id TEXT NOT NULL PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES loan_contracts(id) ON DELETE RESTRICT,
  installment_no INTEGER NOT NULL CHECK (installment_no > 0),
  due_on TEXT NOT NULL,
  principal_due_satang INTEGER NOT NULL CHECK (principal_due_satang >= 0),
  interest_due_satang INTEGER NOT NULL DEFAULT 0 CHECK (interest_due_satang >= 0),
  status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'partial', 'paid', 'waived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (contract_id, installment_no)
);
CREATE TABLE payments (
  id TEXT NOT NULL PRIMARY KEY,
  receipt_no TEXT NOT NULL UNIQUE,
  contract_id TEXT NOT NULL REFERENCES loan_contracts(id) ON DELETE RESTRICT,
  amount_satang INTEGER NOT NULL CHECK (amount_satang > 0),
  paid_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'bank_transfer', 'payroll_deduction', 'other')),
  reference_no TEXT,
  note TEXT,
  recorded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE payment_allocations (
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  installment_id TEXT NOT NULL REFERENCES installments(id) ON DELETE RESTRICT,
  amount_satang INTEGER NOT NULL CHECK (amount_satang > 0),
  PRIMARY KEY (payment_id, installment_id)
);
CREATE TABLE organization_settings (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (organization_id, setting_key)
);
CREATE TABLE audit_logs (
  id TEXT NOT NULL PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_values_json TEXT,
  new_values_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_members_department ON members(department_id);
CREATE INDEX idx_applications_member_date ON loan_applications(member_id, submitted_at DESC);
CREATE INDEX idx_applications_status_date ON loan_applications(status, submitted_at DESC);
CREATE INDEX idx_documents_application ON loan_documents(application_id);
CREATE INDEX idx_contracts_member_status ON loan_contracts(member_id, status);
CREATE INDEX idx_installments_due_status ON installments(due_on, status);
CREATE INDEX idx_payments_contract_date ON payments(contract_id, paid_at DESC);
CREATE INDEX idx_allocations_installment ON payment_allocations(installment_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE TABLE company_ledger_entries (
  id TEXT NOT NULL PRIMARY KEY,
  import_key TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  occurred_at TEXT NOT NULL,
  transaction_date TEXT NOT NULL,
  transaction_time TEXT,
  transaction_no TEXT,
  headquarters_code TEXT,
  branch_code TEXT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  related_party TEXT,
  payment_channel TEXT,
  reference_no TEXT,
  source_label TEXT,
  base_amount_satang INTEGER NOT NULL DEFAULT 0 CHECK (base_amount_satang >= 0),
  vat_percent REAL,
  vat_amount_satang INTEGER NOT NULL DEFAULT 0 CHECK (vat_amount_satang >= 0),
  withholding_percent REAL,
  withholding_amount_satang INTEGER NOT NULL DEFAULT 0 CHECK (withholding_amount_satang >= 0),
  net_income_satang INTEGER NOT NULL DEFAULT 0 CHECK (net_income_satang >= 0),
  net_expense_satang INTEGER NOT NULL DEFAULT 0 CHECK (net_expense_satang >= 0),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organization_id, transaction_no)
);
CREATE INDEX idx_ledger_org_date ON company_ledger_entries(organization_id, occurred_at DESC);
CREATE INDEX idx_ledger_member ON company_ledger_entries(member_id, occurred_at DESC);
