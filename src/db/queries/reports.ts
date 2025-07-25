// Report-related query functions
// Implements type-safe queries for moonwall test report insertion and retrieval

import {
  eq,
  desc,
  asc,
  and,
  or,
  gte,
  lte,
  like,
  sql,
  count,
  inArray,
} from 'drizzle-orm';
import { db } from '../connection';
import { reports, testResults, type Report, type NewReport } from '../schema';

// Types for query parameters
export interface ReportFilters {
  blockchain?: string;
  testSuite?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  minDuration?: number;
  maxDuration?: number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'timestamp' | 'duration' | 'blockchain' | 'testSuite' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ReportWithCounts extends Report {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
}

// Insert a new report with type safety
export async function insertReport(reportData: NewReport): Promise<Report> {
  const [insertedReport] = await db
    .insert(reports)
    .values(reportData)
    .returning();

  if (!insertedReport) {
    throw new Error('Failed to insert report');
  }

  return insertedReport;
}

// Insert multiple reports in a transaction
export async function insertReports(
  reportsData: NewReport[]
): Promise<Report[]> {
  if (reportsData.length === 0) {
    return [];
  }

  const insertedReports = await db
    .insert(reports)
    .values(reportsData)
    .returning();

  return insertedReports;
}

// Get a single report by ID
export async function getReportById(id: string): Promise<Report | null> {
  const [report] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);

  return report || null;
}

// Get reports with filtering, sorting, and pagination
export async function getReports(
  filters: ReportFilters = {},
  pagination: PaginationOptions = {}
): Promise<{
  data: Report[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const {
    blockchain,
    testSuite,
    status,
    dateFrom,
    dateTo,
    search,
    minDuration,
    maxDuration,
  } = filters;

  const {
    page = 1,
    limit = 50,
    sortBy = 'timestamp',
    sortOrder = 'desc',
  } = pagination;

  // Build where conditions
  const conditions = [];

  if (blockchain) {
    conditions.push(eq(reports.blockchain, blockchain));
  }

  if (testSuite) {
    conditions.push(like(reports.testSuite, `%${testSuite}%`));
  }

  if (status) {
    conditions.push(eq(reports.status, status));
  }

  if (dateFrom) {
    conditions.push(gte(reports.timestamp, dateFrom));
  }

  if (dateTo) {
    conditions.push(lte(reports.timestamp, dateTo));
  }

  if (search) {
    // Search across blockchain, testSuite, and metadata
    conditions.push(
      or(
        like(reports.blockchain, `%${search}%`),
        like(reports.testSuite, `%${search}%`),
        sql`${reports.metadata}::text ILIKE ${`%${search}%`}`
      )
    );
  }

  if (minDuration !== undefined) {
    conditions.push(gte(reports.duration, minDuration));
  }

  if (maxDuration !== undefined) {
    conditions.push(lte(reports.duration, maxDuration));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Build sort clause
  const validSortColumns = {
    timestamp: reports.timestamp,
    duration: reports.duration,
    blockchain: reports.blockchain,
    testSuite: reports.testSuite,
    status: reports.status,
  } as const;

  const sortColumn =
    validSortColumns[sortBy as keyof typeof validSortColumns] ||
    reports.timestamp;
  const orderClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

  // Calculate offset
  const offset = (page - 1) * limit;

  // Execute queries in parallel
  const [data, totalResult] = await Promise.all([
    // Get paginated data
    db
      .select()
      .from(reports)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset),

    // Get total count
    db.select({ count: count() }).from(reports).where(whereClause),
  ]);

  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages,
  };
}

// Get reports with test result counts
export async function getReportsWithCounts(
  filters: ReportFilters = {},
  pagination: PaginationOptions = {}
): Promise<{
  data: ReportWithCounts[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const {
    blockchain,
    testSuite,
    status,
    dateFrom,
    dateTo,
    search,
    minDuration,
    maxDuration,
  } = filters;

  const {
    page = 1,
    limit = 50,
    sortBy = 'timestamp',
    sortOrder = 'desc',
  } = pagination;

  // Build where conditions for reports
  const reportConditions = [];

  if (blockchain) {
    reportConditions.push(eq(reports.blockchain, blockchain));
  }

  if (testSuite) {
    reportConditions.push(like(reports.testSuite, `%${testSuite}%`));
  }

  if (status) {
    reportConditions.push(eq(reports.status, status));
  }

  if (dateFrom) {
    reportConditions.push(gte(reports.timestamp, dateFrom));
  }

  if (dateTo) {
    reportConditions.push(lte(reports.timestamp, dateTo));
  }

  if (search) {
    reportConditions.push(
      or(
        like(reports.blockchain, `%${search}%`),
        like(reports.testSuite, `%${search}%`),
        sql`${reports.metadata}::text ILIKE ${`%${search}%`}`
      )
    );
  }

  if (minDuration !== undefined) {
    reportConditions.push(gte(reports.duration, minDuration));
  }

  if (maxDuration !== undefined) {
    reportConditions.push(lte(reports.duration, maxDuration));
  }

  const whereClause =
    reportConditions.length > 0 ? and(...reportConditions) : undefined;

  // Build sort clause
  const validSortColumns = {
    timestamp: reports.timestamp,
    duration: reports.duration,
    blockchain: reports.blockchain,
    testSuite: reports.testSuite,
    status: reports.status,
  } as const;

  const sortColumn =
    validSortColumns[sortBy as keyof typeof validSortColumns] ||
    reports.timestamp;
  const orderClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

  // Calculate offset
  const offset = (page - 1) * limit;

  // Execute complex query with test result counts
  const query = db
    .select({
      id: reports.id,
      blockchain: reports.blockchain,
      testSuite: reports.testSuite,
      timestamp: reports.timestamp,
      status: reports.status,
      duration: reports.duration,
      metadata: reports.metadata,
      createdAt: reports.createdAt,
      updatedAt: reports.updatedAt,
      totalTests: sql<number>`COALESCE(COUNT(${testResults.id}), 0)::int`,
      passedTests: sql<number>`COALESCE(COUNT(CASE WHEN ${testResults.status} = 'pass' THEN 1 END), 0)::int`,
      failedTests: sql<number>`COALESCE(COUNT(CASE WHEN ${testResults.status} = 'fail' THEN 1 END), 0)::int`,
      skippedTests: sql<number>`COALESCE(COUNT(CASE WHEN ${testResults.status} = 'skip' THEN 1 END), 0)::int`,
    })
    .from(reports)
    .leftJoin(testResults, eq(reports.id, testResults.reportId))
    .where(whereClause)
    .groupBy(reports.id)
    .orderBy(orderClause)
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalQuery = db
    .select({ count: count() })
    .from(reports)
    .where(whereClause);

  const [data, totalResult] = await Promise.all([query, totalQuery]);

  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages,
  };
}

// Get recent reports (last 24 hours by default)
export async function getRecentReports(
  hours: number = 24,
  limit: number = 100
): Promise<Report[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return db
    .select()
    .from(reports)
    .where(gte(reports.timestamp, since))
    .orderBy(desc(reports.timestamp))
    .limit(limit);
}

// Get reports by blockchain
export async function getReportsByBlockchain(
  blockchain: string,
  limit: number = 100
): Promise<Report[]> {
  return db
    .select()
    .from(reports)
    .where(eq(reports.blockchain, blockchain))
    .orderBy(desc(reports.timestamp))
    .limit(limit);
}

// Get reports by status
export async function getReportsByStatus(
  status: string,
  limit: number = 100
): Promise<Report[]> {
  return db
    .select()
    .from(reports)
    .where(eq(reports.status, status))
    .orderBy(desc(reports.timestamp))
    .limit(limit);
}

// Update report status
export async function updateReportStatus(
  id: string,
  status: string
): Promise<Report | null> {
  const [updatedReport] = await db
    .update(reports)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(reports.id, id))
    .returning();

  return updatedReport || null;
}

// Delete a report and all associated test results (cascade)
export async function deleteReport(id: string): Promise<boolean> {
  const result = await db
    .delete(reports)
    .where(eq(reports.id, id))
    .returning({ id: reports.id });

  return result.length > 0;
}

// Delete multiple reports
export async function deleteReports(ids: string[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const result = await db
    .delete(reports)
    .where(inArray(reports.id, ids))
    .returning({ id: reports.id });

  return result.length;
}

// Get unique blockchains
export async function getUniqueBlockchains(): Promise<string[]> {
  const result = await db
    .selectDistinct({ blockchain: reports.blockchain })
    .from(reports)
    .orderBy(asc(reports.blockchain));

  return result.map(r => r.blockchain);
}

// Get unique test suites
export async function getUniqueTestSuites(): Promise<string[]> {
  const result = await db
    .selectDistinct({ testSuite: reports.testSuite })
    .from(reports)
    .orderBy(asc(reports.testSuite));

  return result.map(r => r.testSuite);
}
