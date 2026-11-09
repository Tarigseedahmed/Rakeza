-- PostgreSQL starter schema. Apply tenant scoping and migrations through the chosen migration tool.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  currency char(3) NOT NULL DEFAULT 'SAR',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  email citext NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','invited','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (organization_id, name)
);
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_number text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email citext,
  department text,
  job_title text,
  employment_status text NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active','on_leave','terminated')),
  hire_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_number)
);
CREATE TABLE employment_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  contract_type text NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  salary_amount numeric(12,2) NOT NULL CHECK (salary_amount >= 0),
  currency char(3) NOT NULL DEFAULT 'SAR',
  status text NOT NULL CHECK (status IN ('draft','active','expired','terminated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  work_date date NOT NULL,
  check_in timestamptz,
  check_out timestamptz,
  status text NOT NULL CHECK (status IN ('present','late','absent','remote','leave')),
  source text NOT NULL DEFAULT 'manual',
  UNIQUE (employee_id, work_date),
  CHECK (check_out IS NULL OR check_in IS NULL OR check_out >= check_in)
);
CREATE TABLE leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  leave_type text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  days numeric(6,2) NOT NULL CHECK (days > 0),
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_by uuid REFERENCES user_accounts(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);
CREATE TABLE advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'SAR',
  issued_on date NOT NULL,
  status text NOT NULL CHECK (status IN ('requested','approved','paid','repaid','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payroll_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_amount numeric(12,2) NOT NULL CHECK (gross_amount >= 0),
  deductions numeric(12,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  net_amount numeric(12,2) NOT NULL CHECK (net_amount >= 0),
  currency char(3) NOT NULL DEFAULT 'SAR',
  status text NOT NULL CHECK (status IN ('draft','approved','paid')),
  CHECK (period_end >= period_start)
);
-- Keep each document as its own normalized row; the UI groups these rows by employee.
CREATE TABLE organization_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  title text NOT NULL,
  document_type text NOT NULL,
  document_number text NOT NULL,
  issuing_authority text,
  issued_on date,
  expires_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (issued_on IS NULL OR expires_on >= issued_on)
);
CREATE TABLE employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  document_type text NOT NULL,
  document_number text NOT NULL,
  issued_on date,
  expires_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (issued_on IS NULL OR expires_on >= issued_on)
);
CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid REFERENCES employees(id),
  organization_document_id uuid REFERENCES organization_documents(id),
  employee_document_id uuid REFERENCES employee_documents(id),
  object_key text NOT NULL,
  original_name text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  uploaded_by uuid NOT NULL REFERENCES user_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (organization_document_id IS NULL OR employee_document_id IS NULL)
);
CREATE TABLE audit_events (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  actor_id uuid REFERENCES user_accounts(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  trace_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX employees_org_status_idx ON employees(organization_id, employment_status);
CREATE INDEX contracts_org_end_idx ON employment_contracts(organization_id, ends_on) WHERE status = 'active';
CREATE INDEX attendance_org_date_idx ON attendance_records(organization_id, work_date);
CREATE INDEX leave_org_status_idx ON leave_requests(organization_id, status, created_at DESC);
CREATE INDEX organization_docs_expiry_idx ON organization_documents(organization_id, expires_on);
CREATE INDEX employee_docs_expiry_idx ON employee_documents(organization_id, expires_on);
CREATE INDEX employee_docs_owner_idx ON employee_documents(organization_id, employee_id, expires_on);
CREATE INDEX audit_org_time_idx ON audit_events(organization_id, occurred_at DESC);
