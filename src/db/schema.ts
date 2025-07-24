// Database schema definitions using Drizzle ORM
// This file will be expanded in task 2.2 to include the full schema

import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Temporary test table for migration testing
export const testTable = pgTable('test_table', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Export placeholder for now to prevent import errors
export const placeholder = 'Schema will be defined in task 2.2';
