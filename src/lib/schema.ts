import {
  mysqlTable,
  int,
  varchar,
  text,
  decimal,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  customType,
} from "drizzle-orm/mysql-core";

const mediumBlob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "mediumblob";
  },
  fromDriver(value: Buffer) {
    return value;
  },
  toDriver(value: Buffer) {
    return value;
  },
});

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: varchar("role", { length: 50 }).notNull().default("project_manager"),
  department: varchar("department", { length: 100 }),
  assignedProjectId: int("assigned_project_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_username_idx").on(t.username)]);

export const projectAssignments = mysqlTable("project_assignments", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  projectId: int("project_id").notNull(),
});

export const projects = mysqlTable("projects", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  client: varchar("client", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  contractValue: decimal("contract_value", { precision: 15, scale: 2 }).notNull().default("0"),
  budgetAllocated: decimal("budget_allocated", { precision: 15, scale: 2 }).notNull().default("0"),
  progressPercent: int("progress_percent").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const expenseCategories = mysqlTable("expense_categories", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const catalogItems = mysqlTable("catalog_items", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull().default(""),
  defaultUnitPrice: decimal("default_unit_price", { precision: 15, scale: 2 }).notNull().default("0"),
  defaultEstimatedPrice: decimal("default_estimated_price", { precision: 15, scale: 2 }).notNull().default("0"),
  category: varchar("category", { length: 100 }),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("catalog_items_code_idx").on(t.code)]);

export const expenses = mysqlTable("expenses", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  category: varchar("category", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("expense"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  submittedBy: varchar("submitted_by", { length: 255 }).notNull(),
  submittedById: int("submitted_by_id"),
  contractorId: int("contractor_id"),
  projectItemId: int("project_item_id"),
  managerApprovedBy: varchar("manager_approved_by", { length: 255 }),
  managerApprovedAt: timestamp("manager_approved_at"),
  accountantApprovedBy: varchar("accountant_approved_by", { length: 255 }),
  accountantApprovedAt: timestamp("accountant_approved_at"),
  approvedBy: varchar("approved_by", { length: 255 }),
  rejectionReason: text("rejection_reason"),
  expenseDate: date("expense_date").notNull(),
  attachmentUrl: varchar("attachment_url", { length: 500 }),
  supplierId: int("supplier_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const projectItems = mysqlTable("project_items", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  catalogItemId: int("catalog_item_id"),
  itemCode: varchar("item_code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull().default(""),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull().default("0"),
  estimatedPrice: decimal("estimated_price", { precision: 15, scale: 2 }).notNull().default("0"),
  executedPrice: decimal("executed_price", { precision: 15, scale: 2 }).notNull().default("0"),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull().default("1"),
  executedQuantity: decimal("executed_quantity", { precision: 15, scale: 3 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pettyCash = mysqlTable("petty_cash", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id"),
  assignedTo: varchar("assigned_to", { length: 255 }).notNull(),
  assignedToId: int("assigned_to_id").notNull(),
  issuedById: int("issued_by_id"),
  purpose: varchar("purpose", { length: 255 }).notNull(),
  allocatedAmount: decimal("allocated_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  usedAmount: decimal("used_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 50 }).notNull().default("open"),
  issuedDate: date("issued_date").notNull(),
  settledDate: date("settled_date"),
  settledById: int("settled_by_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const contractors = mysqlTable("contractors", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  specialty: varchar("specialty", { length: 100 }),
  licenseNumber: varchar("license_number", { length: 100 }),
  vatNumber: varchar("vat_number", { length: 50 }),
  address: text("address"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const contracts = mysqlTable("contracts", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  contractorId: int("contractor_id").notNull(),
  contractType: varchar("contract_type", { length: 50 }).notNull().default("quantity"),
  title: varchar("title", { length: 255 }).notNull(),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const contractItems = mysqlTable("contract_items", {
  id: int("id").primaryKey().autoincrement(),
  contractId: int("contract_id"),
  contractorId: int("contractor_id").notNull(),
  projectId: int("project_id").notNull(),
  projectItemId: int("project_item_id"),
  catalogItemId: int("catalog_item_id"),
  contractType: varchar("contract_type", { length: 50 }).notNull().default("quantity"),
  itemCode: varchar("item_code", { length: 50 }),
  description: text("description").notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull().default("0"),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull().default("0"),
  companyUnitCost: decimal("company_unit_cost", { precision: 15, scale: 2 }).notNull().default("0"),
  completedQuantity: decimal("completed_quantity", { precision: 15, scale: 3 }).notNull().default("0"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tasks = mysqlTable("tasks", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  projectId: int("project_id"),
  projectItemId: int("project_item_id"),
  contractorId: int("contractor_id"),
  assigneeId: int("assignee_id").notNull(),
  createdById: int("created_by_id").notNull(),
  priority: varchar("priority", { length: 20 }).notNull().default("medium"),
  status: varchar("status", { length: 50 }).notNull().default("new"),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  source: varchar("source", { length: 50 }).notNull().default("manual"),
  sourceRef: varchar("source_ref", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull().default("info"),
  link: varchar("link", { length: 500 }),
  isRead: boolean("is_read").notNull().default(false),
  emailSent: boolean("email_sent").notNull().default(false),
  emailStatus: varchar("email_status", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const suppliers = mysqlTable("suppliers", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  category: varchar("category", { length: 100 }),
  vatNumber: varchar("vat_number", { length: 50 }),
  address: text("address"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const purchases = mysqlTable("purchases", {
  id: int("id").primaryKey().autoincrement(),
  supplierId: int("supplier_id").notNull(),
  projectId: int("project_id").notNull(),
  purchaseNumber: varchar("purchase_number", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("unpaid"),
  orderDate: date("order_date").notNull(),
  expectedDelivery: date("expected_delivery"),
  actualDelivery: date("actual_delivery"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const extracts = mysqlTable("extracts", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  contractorId: int("contractor_id"),
  extractNumber: varchar("extract_number", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  submittedBy: varchar("submitted_by", { length: 255 }).notNull(),
  submittedById: int("submitted_by_id"),
  managerApprovedBy: varchar("manager_approved_by", { length: 255 }),
  managerApprovedAt: timestamp("manager_approved_at"),
  accountantApprovedBy: varchar("accountant_approved_by", { length: 255 }),
  accountantApprovedAt: timestamp("accountant_approved_at"),
  approvedBy: varchar("approved_by", { length: 255 }),
  extractDate: date("extract_date").notNull(),
  workPeriodFrom: date("work_period_from"),
  workPeriodTo: date("work_period_to"),
  paidAt: date("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const extractLineItems = mysqlTable("extract_line_items", {
  id: int("id").primaryKey().autoincrement(),
  extractId: int("extract_id").notNull(),
  projectItemId: int("project_item_id"),
  contractItemId: int("contract_item_id"),
  description: text("description").notNull(),
  unit: varchar("unit", { length: 50 }).notNull().default(""),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull().default("0"),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull().default("0"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
});

export const fileUploads = mysqlTable("file_uploads", {
  id: int("id").primaryKey().autoincrement(),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 127 }).notNull(),
  size: int("size").notNull(),
  data: mediumBlob("data").notNull(),
  createdById: int("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
