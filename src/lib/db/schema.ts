// Dayflow — Drizzle ORM schema (SQLite)
//
// This file is the single source of truth for the shape of the
// domain entities described in the Dayflow requirements: users,
// employees, departments, attendance, leave requests,
// leave balances, payroll, documents, notifications and
// activity/audit events.
//
// Table creation itself happens via the plain-SQL migration in
// `migrations.sql` (see db/client.ts) — this file exists to give
// the application layer typed, composable query building via
// drizzle-orm.

import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

import {
  relations,
  sql,
} from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ROLES = [
  "EMPLOYEE",
  "HR",
] as const;

export type Role =
  (typeof ROLES)[number];

export const EMPLOYMENT_STATUSES = [
  "ACTIVE",
  "INACTIVE",
] as const;

export type EmploymentStatus =
  (typeof EMPLOYMENT_STATUSES)[number];

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "HALF_DAY",
  "LEAVE",
] as const;

export type AttendanceStatus =
  (typeof ATTENDANCE_STATUSES)[number];

export const LEAVE_TYPES = [
  "PAID",
  "SICK",
  "UNPAID",
] as const;

export type LeaveType =
  (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export type LeaveStatus =
  (typeof LEAVE_STATUSES)[number];

export const PAYROLL_STATUSES = [
  "DRAFT",
  "PUBLISHED",
] as const;

export type PayrollStatus =
  (typeof PAYROLL_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "LEAVE_SUBMITTED",
  "LEAVE_APPROVED",
  "LEAVE_REJECTED",
  "ATTENDANCE_REMINDER",
  "PAYROLL_AVAILABLE",
  "PROFILE_INCOMPLETE",
  "ANNOUNCEMENT",
] as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[number];

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const departments = sqliteTable(
  "departments",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),

    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    nameIdx: uniqueIndex(
      "departments_name_idx"
    ).on(t.name),
  })
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),

    employeeCode: text("employee_code")
      .notNull(),

    email: text("email").notNull(),

    passwordHash: text("password_hash")
      .notNull(),

    role: text("role")
      .$type<Role>()
      .notNull()
      .default("EMPLOYEE"),

    emailVerified: integer(
      "email_verified",
      {
        mode: "boolean",
      }
    )
      .notNull()
      .default(false),

    // Stores a SHA-256 hash of the current
    // pending verification token, never the
    // raw token itself.
    emailVerificationToken: text(
      "email_verification_token"
    ),

    // ISO datetime the current pending token
    // expires at.
    emailVerificationExpiresAt: text(
      "email_verification_expires_at"
    ),

    isActive: integer(
      "is_active",
      {
        mode: "boolean",
      }
    )
      .notNull()
      .default(true),

    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),

    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    emailIdx: uniqueIndex(
      "users_email_idx"
    ).on(t.email),

    employeeCodeIdx: uniqueIndex(
      "users_employee_code_idx"
    ).on(t.employeeCode),
  })
);

export const employees = sqliteTable(
  "employees",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull(),

    fullName: text("full_name")
      .notNull(),

    departmentId: text("department_id"),

    jobTitle: text("job_title"),

    managerId: text("manager_id"),

    employmentStatus: text(
      "employment_status"
    )
      .$type<EmploymentStatus>()
      .notNull()
      .default("ACTIVE"),

    dateOfJoining: text(
      "date_of_joining"
    ),

    phone: text("phone"),

    address: text("address"),

    emergencyContactName: text(
      "emergency_contact_name"
    ),

    emergencyContactPhone: text(
      "emergency_contact_phone"
    ),

    profilePhotoUrl: text(
      "profile_photo_url"
    ),

    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),

    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    userIdx: uniqueIndex(
      "employees_user_id_idx"
    ).on(t.userId),

    deptIdx: index(
      "employees_department_idx"
    ).on(t.departmentId),

    managerIdx: index(
      "employees_manager_idx"
    ).on(t.managerId),
  })
);

export const attendance = sqliteTable(
  "attendance",
  {
    id: text("id").primaryKey(),

    employeeId: text("employee_id")
      .notNull(),

    date: text("date").notNull(),

    checkInAt: text("check_in_at"),

    checkOutAt: text("check_out_at"),

    status: text("status")
      .$type<AttendanceStatus>()
      .notNull(),

    notes: text("notes"),

    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),

    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    empDateIdx: uniqueIndex(
      "attendance_employee_date_idx"
    ).on(
      t.employeeId,
      t.date
    ),

    dateIdx: index(
      "attendance_date_idx"
    ).on(t.date),
  })
);

export const leaveBalances = sqliteTable(
  "leave_balances",
  {
    id: text("id").primaryKey(),

    employeeId: text("employee_id")
      .notNull(),

    leaveType: text("leave_type")
      .$type<LeaveType>()
      .notNull(),

    year: integer("year")
      .notNull(),

    totalDays: real("total_days")
      .notNull(),

    usedDays: real("used_days")
      .notNull()
      .default(0),
  },
  (t) => ({
    empTypeYearIdx: uniqueIndex(
      "leave_balances_emp_type_year_idx"
    ).on(
      t.employeeId,
      t.leaveType,
      t.year
    ),
  })
);

export const leaveRequests = sqliteTable(
  "leave_requests",
  {
    id: text("id").primaryKey(),

    employeeId: text("employee_id")
      .notNull(),

    leaveType: text("leave_type")
      .$type<LeaveType>()
      .notNull(),

    startDate: text("start_date")
      .notNull(),

    endDate: text("end_date")
      .notNull(),

    workingDays: real("working_days")
      .notNull(),

    remarks: text("remarks"),

    status: text("status")
      .$type<LeaveStatus>()
      .notNull()
      .default("PENDING"),

    hrComment: text("hr_comment"),

    reviewedBy: text("reviewed_by"),

    reviewedAt: text("reviewed_at"),

    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),

    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    empIdx: index(
      "leave_requests_employee_idx"
    ).on(t.employeeId),

    statusIdx: index(
      "leave_requests_status_idx"
    ).on(t.status),
  })
);

export const payrollRecords = sqliteTable(
  "payroll_records",
  {
    id: text("id").primaryKey(),

    employeeId: text("employee_id")
      .notNull(),

    effectiveMonth: text(
      "effective_month"
    ).notNull(),

    currency: text("currency")
      .notNull()
      .default("INR"),

    basicSalary: real("basic_salary")
      .notNull(),

    allowances: real("allowances")
      .notNull()
      .default(0),

    deductions: real("deductions")
      .notNull()
      .default(0),

    netSalary: real("net_salary")
      .notNull(),

    status: text("status")
      .$type<PayrollStatus>()
      .notNull()
      .default("DRAFT"),

    notes: text("notes"),

    createdBy: text("created_by"),

    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),

    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    empMonthIdx: uniqueIndex(
      "payroll_employee_month_idx"
    ).on(
      t.employeeId,
      t.effectiveMonth
    ),
  })
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),

    employeeId: text("employee_id")
      .notNull(),

    name: text("name").notNull(),

    fileType: text("file_type")
      .notNull(),

    fileSize: integer("file_size")
      .notNull(),

    storageKey: text("storage_key")
      .notNull(),

    uploadedBy: text("uploaded_by")
      .notNull(),

    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    empIdx: index(
      "documents_employee_idx"
    ).on(t.employeeId),
  })
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),

    recipientId: text("recipient_id")
      .notNull(),

    type: text("type")
      .$type<NotificationType>()
      .notNull(),

    title: text("title")
      .notNull(),

    message: text("message")
      .notNull(),

    isRead: integer(
      "is_read",
      {
        mode: "boolean",
      }
    )
      .notNull()
      .default(false),

    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    recipientIdx: index(
      "notifications_recipient_idx"
    ).on(t.recipientId),
  })
);

export const activityEvents = sqliteTable(
  "activity_events",
  {
    id: text("id").primaryKey(),

    actorId: text("actor_id"),

    action: text("action").notNull(),

    entityType: text("entity_type")
      .notNull(),

    entityId: text("entity_id")
      .notNull(),

    subjectEmployeeId: text(
      "subject_employee_id"
    ).notNull(),

    metadata: text("metadata"),

    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    subjectIdx: index(
      "activity_events_subject_idx"
    ).on(t.subjectEmployeeId),

    createdIdx: index(
      "activity_events_created_idx"
    ).on(t.createdAt),
  })
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(
  users,
  ({ one }) => ({
    employee: one(employees, {
      fields: [users.id],
      references: [employees.userId],
    }),
  })
);

export const employeesRelations = relations(
  employees,
  ({ one, many }) => ({
    user: one(users, {
      fields: [employees.userId],
      references: [users.id],
    }),

    department: one(departments, {
      fields: [employees.departmentId],
      references: [departments.id],
    }),

    manager: one(employees, {
      fields: [employees.managerId],
      references: [employees.id],
    }),

    attendance: many(attendance),

    leaveRequests: many(
      leaveRequests
    ),

    payrollRecords: many(
      payrollRecords
    ),
  })
);

export const attendanceRelations =
  relations(
    attendance,
    ({ one }) => ({
      employee: one(employees, {
        fields: [
          attendance.employeeId,
        ],
        references: [
          employees.id,
        ],
      }),
    })
  );

export const leaveRequestsRelations =
  relations(
    leaveRequests,
    ({ one }) => ({
      employee: one(employees, {
        fields: [
          leaveRequests.employeeId,
        ],
        references: [
          employees.id,
        ],
      }),
    })
  );

export const payrollRecordsRelations =
  relations(
    payrollRecords,
    ({ one }) => ({
      employee: one(employees, {
        fields: [
          payrollRecords.employeeId,
        ],
        references: [
          employees.id,
        ],
      }),
    })
  );