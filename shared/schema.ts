import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User authentication table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  googleId: varchar("google_id").unique().notNull(),
  email: varchar("email").unique().notNull(),
  name: varchar("name").notNull(),
  picture: varchar("picture"),
  role: varchar("role").default("user").notNull(), // "admin", "user"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Google Sheets metadata
export const sheets = pgTable("sheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  googleSheetId: text("google_sheet_id").notNull(),
  sheetTabId: integer("sheet_tab_id").notNull(),
  headers: text("headers").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sheet records (cached from Google Sheets)
export const sheetRecords = pgTable("sheet_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sheetId: varchar("sheet_id").references(() => sheets.id).notNull(),
  rowIndex: integer("row_index").notNull(),
  data: text("data").notNull(), // JSON string of row data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Dashboard metrics (computed from sheet data)
export const dashboardMetrics = pgTable("dashboard_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'financial' or 'project'
  name: text("name").notNull(),
  value: decimal("value", { precision: 15, scale: 2 }).notNull(),
  period: text("period").notNull(), // 'monthly', 'yearly', etc.
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
});

// Projects (for project tracking)
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  budget: decimal("budget", { precision: 15, scale: 2 }),
  spent: decimal("spent", { precision: 15, scale: 2 }).default("0"),
  progress: integer("progress").default(0), // percentage
  status: text("status").notNull().default("active"), // 'active', 'completed', 'paused'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Financial transactions (for accounting)
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  type: text("type").notNull(), // 'income' or 'expense'
  category: text("category").notNull(),
  projectId: varchar("project_id").references(() => projects.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Karar Destek Sistemi - Correspondence Metadata
export const correspondenceMetadata = pgTable("correspondence_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  letterNo: text("letter_no").notNull(),
  letterDate: timestamp("letter_date").notNull(),
  parties: text("parties").notNull(),
  subject: text("subject").notNull(),
  contentType: text("content_type").notNull(),
  projectName: text("project_name").notNull(),
  criticality: integer("criticality").notNull(),
  decisionMade: boolean("decision_made").notNull().default(false),
  decisionDate: timestamp("decision_date"),
  relatedDocs: text("related_docs").array().default(sql`ARRAY[]::text[]`),
  content: text("content").notNull(),
  riskLevel: text("risk_level").notNull(),
  sentiment: text("sentiment").notNull(),
  keywords: text("keywords").array().default(sql`ARRAY[]::text[]`),
  aiAnalysis: jsonb("ai_analysis"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_correspondence_metadata_letter_date").on(table.letterDate),
  index("idx_correspondence_metadata_project_name").on(table.projectName),
  index("idx_correspondence_metadata_content_type").on(table.contentType),
  index("idx_correspondence_metadata_criticality").on(table.criticality),
  index("idx_correspondence_metadata_risk_level").on(table.riskLevel),
  index("idx_correspondence_metadata_keywords").on(table.keywords),
  index("idx_correspondence_metadata_ai_analysis").on(table.aiAnalysis),
]);

// Insert schemas
export const insertSheetSchema = createInsertSchema(sheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSheetRecordSchema = createInsertSchema(sheetRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schema for correspondence metadata
export const insertCorrespondenceMetadataSchema = createInsertSchema(correspondenceMetadata, {
  letterDate: z.coerce.date(),
  decisionDate: z.coerce.date().optional(),
  criticality: z.number().min(1).max(10),
  contentType: z.enum(["Bilgilendirme", "İhtar", "Cevap", "Talep", "Başvuru", "Diğer"]),
  riskLevel: z.enum(["Düşük", "Orta", "Yüksek"]),
  sentiment: z.enum(["Pozitif", "Nötr", "Negatif"]),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Sheet = typeof sheets.$inferSelect;
export type InsertSheet = z.infer<typeof insertSheetSchema>;

export type SheetRecord = typeof sheetRecords.$inferSelect;
export type InsertSheetRecord = z.infer<typeof insertSheetRecordSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type DashboardMetric = typeof dashboardMetrics.$inferSelect;
export type CorrespondenceMetadata = typeof correspondenceMetadata.$inferSelect;

// API response types
export type SheetData = {
  sheet: Sheet;
  records: any[][];
  headers: string[];
};

export type DashboardData = {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  activeProjects: number;
  monthlyData: Array<{
    month: string;
    income: number;
    expenses: number;
  }>;
  expenseCategories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  projects: Array<Project>;
};

// Form schemas for validation
export const addRecordFormSchema = z.object({
  date: z.string().min(1, "Tarih gerekli"),
  description: z.string().min(1, "Açıklama gerekli"),
  amount: z.number().min(0, "Tutar 0'dan büyük olmalı"),
  type: z.enum(["Gelir", "Gider"], { required_error: "Tür seçimi gerekli" }),
  category: z.string().min(1, "Kategori gerekli"),
});

export const createSheetFormSchema = z.object({
  name: z.string().min(1, "Sheet adı gerekli"),
  template: z.enum(["custom", "accounting", "project", "personnel"]),
});

export type AddRecordForm = z.infer<typeof addRecordFormSchema>;
export type CreateSheetForm = z.infer<typeof createSheetFormSchema>;

// User schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
