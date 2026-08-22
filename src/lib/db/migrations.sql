-- Dayflow initial schema (SQLite)
-- Applied idempotently at startup by db/client.ts via
-- `CREATE TABLE IF NOT EXISTS`.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS departments_name_idx
ON departments(name);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  employee_code TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'EMPLOYEE'
    CHECK (role IN ('EMPLOYEE','HR')),

  email_verified INTEGER NOT NULL DEFAULT 0,

  email_verification_token TEXT,

  email_verification_expires_at TEXT,

  is_active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx
ON users(email);

CREATE UNIQUE INDEX IF NOT EXISTS users_employee_code_idx
ON users(employee_code);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  full_name TEXT NOT NULL,

  department_id TEXT
    REFERENCES departments(id)
    ON DELETE SET NULL,

  job_title TEXT,

  manager_id TEXT
    REFERENCES employees(id)
    ON DELETE SET NULL,

  employment_status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (employment_status IN ('ACTIVE','INACTIVE')),

  date_of_joining TEXT,

  phone TEXT,
  address TEXT,

  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,

  profile_photo_url TEXT,

  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS employees_user_id_idx
ON employees(user_id);

CREATE INDEX IF NOT EXISTS employees_department_idx
ON employees(department_id);

CREATE INDEX IF NOT EXISTS employees_manager_idx
ON employees(manager_id);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,

  employee_id TEXT NOT NULL
    REFERENCES employees(id)
    ON DELETE CASCADE,

  date TEXT NOT NULL,

  check_in_at TEXT,
  check_out_at TEXT,

  status TEXT NOT NULL
    CHECK (
      status IN (
        'PRESENT',
        'ABSENT',
        'HALF_DAY',
        'LEAVE'
      )
    ),

  notes TEXT,

  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_employee_date_idx
ON attendance(employee_id, date);

CREATE INDEX IF NOT EXISTS attendance_date_idx
ON attendance(date);

CREATE TABLE IF NOT EXISTS leave_balances (
  id TEXT PRIMARY KEY,

  employee_id TEXT NOT NULL
    REFERENCES employees(id)
    ON DELETE CASCADE,

  leave_type TEXT NOT NULL
    CHECK (
      leave_type IN (
        'PAID',
        'SICK',
        'UNPAID'
      )
    ),

  year INTEGER NOT NULL,

  total_days REAL NOT NULL,

  used_days REAL NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS leave_balances_emp_type_year_idx
ON leave_balances(
  employee_id,
  leave_type,
  year
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,

  employee_id TEXT NOT NULL
    REFERENCES employees(id)
    ON DELETE CASCADE,

  leave_type TEXT NOT NULL
    CHECK (
      leave_type IN (
        'PAID',
        'SICK',
        'UNPAID'
      )
    ),

  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,

  working_days REAL NOT NULL,

  remarks TEXT,

  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (
      status IN (
        'PENDING',
        'APPROVED',
        'REJECTED'
      )
    ),

  hr_comment TEXT,

  reviewed_by TEXT
    REFERENCES employees(id)
    ON DELETE SET NULL,

  reviewed_at TEXT,

  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS leave_requests_employee_idx
ON leave_requests(employee_id);

CREATE INDEX IF NOT EXISTS leave_requests_status_idx
ON leave_requests(status);

CREATE TABLE IF NOT EXISTS payroll_records (
  id TEXT PRIMARY KEY,

  employee_id TEXT NOT NULL
    REFERENCES employees(id)
    ON DELETE CASCADE,

  effective_month TEXT NOT NULL,

  currency TEXT NOT NULL DEFAULT 'INR',

  basic_salary REAL NOT NULL,

  allowances REAL NOT NULL DEFAULT 0,

  deductions REAL NOT NULL DEFAULT 0,

  net_salary REAL NOT NULL,

  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (
      status IN (
        'DRAFT',
        'PUBLISHED'
      )
    ),

  notes TEXT,

  created_by TEXT
    REFERENCES employees(id)
    ON DELETE SET NULL,

  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS payroll_employee_month_idx
ON payroll_records(
  employee_id,
  effective_month
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,

  employee_id TEXT NOT NULL
    REFERENCES employees(id)
    ON DELETE CASCADE,

  name TEXT NOT NULL,

  file_type TEXT NOT NULL,

  file_size INTEGER NOT NULL,

  storage_key TEXT NOT NULL,

  uploaded_by TEXT NOT NULL
    REFERENCES employees(id),

  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS documents_employee_idx
ON documents(employee_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,

  recipient_id TEXT NOT NULL
    REFERENCES employees(id)
    ON DELETE CASCADE,

  type TEXT NOT NULL,

  title TEXT NOT NULL,

  message TEXT NOT NULL,

  is_read INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS notifications_recipient_idx
ON notifications(recipient_id);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,

  actor_id TEXT,

  action TEXT NOT NULL,

  entity_type TEXT NOT NULL,

  entity_id TEXT NOT NULL,

  subject_employee_id TEXT NOT NULL,

  metadata TEXT,

  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS activity_events_subject_idx
ON activity_events(subject_employee_id);

CREATE INDEX IF NOT EXISTS activity_events_created_idx
ON activity_events(created_at);