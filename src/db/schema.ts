// Database schema definitions using Drizzle ORM
// Schema for moonwall test reports monitoring system

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  jsonb,
  text,
  index,
  foreignKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Reports table - stores moonwall test report metadata
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    blockchain: varchar('blockchain', { length: 100 }).notNull(),
    testSuite: varchar('test_suite', { length: 200 }).notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: varchar('status', { length: 20 }).notNull(),
    duration: integer('duration').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  table => [
    // Indexes for efficient querying
    index('idx_reports_timestamp').on(table.timestamp.desc()),
    index('idx_reports_blockchain').on(table.blockchain),
    index('idx_reports_status').on(table.status),
    index('idx_reports_metadata').on(table.metadata),
    // Composite index for common query patterns
    index('idx_reports_blockchain_status').on(table.blockchain, table.status),
    index('idx_reports_timestamp_status').on(
      table.timestamp.desc(),
      table.status
    ),
    // Check constraints (Note: These may need custom migration due to Drizzle Kit limitations)
    check(
      'reports_status_check',
      sql`${table.status} IN ('pass', 'fail', 'skip', 'running', 'pending')`
    ),
    check('reports_duration_check', sql`${table.duration} >= 0`),
    check(
      'reports_blockchain_not_empty',
      sql`length(trim(${table.blockchain})) > 0`
    ),
    check(
      'reports_test_suite_not_empty',
      sql`length(trim(${table.testSuite})) > 0`
    ),
  ]
);

// Test results table - stores individual test results within a report
export const testResults = pgTable(
  'test_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reportId: uuid('report_id').notNull(),
    testName: varchar('test_name', { length: 300 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    duration: integer('duration').notNull(),
    errorMessage: text('error_message'),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  table => [
    // Foreign key relationship
    foreignKey({
      columns: [table.reportId],
      foreignColumns: [reports.id],
      name: 'fk_test_results_report_id',
    }).onDelete('cascade'),
    // Indexes for efficient querying
    index('idx_test_results_report_id').on(table.reportId),
    index('idx_test_results_status').on(table.status),
    index('idx_test_results_test_name').on(table.testName),
    // Composite indexes for common query patterns
    index('idx_test_results_report_status').on(table.reportId, table.status),
    index('idx_test_results_status_test_name').on(table.status, table.testName),
    // Check constraints (Note: These may need custom migration due to Drizzle Kit limitations)
    check(
      'test_results_status_check',
      sql`${table.status} IN ('pass', 'fail', 'skip')`
    ),
    check('test_results_duration_check', sql`${table.duration} >= 0`),
    check(
      'test_results_test_name_not_empty',
      sql`length(trim(${table.testName})) > 0`
    ),
  ]
);

// Temporary test table for migration testing (keeping for backward compatibility)
export const testTable = pgTable('test_table', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Type exports for use in application code
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type TestResult = typeof testResults.$inferSelect;
export type NewTestResult = typeof testResults.$inferInsert;
