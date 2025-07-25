// Test result-related query functions
// Implements type-safe queries for individual test result operations

import {
  eq,
  desc,
  asc,
  and,
  or,
  like,
  sql,
  count,
  inArray,
  gte,
  lte,
} from 'drizzle-orm';
import { db } from '../connection';
import {
  testResults,
  reports,
  type TestResult,
  type NewTestResult,
} from '../schema';

// Types for query parameters
export interface TestResultFilters {
  reportId?: string;
  testName?: string;
  status?: string;
  search?: string;
  minDuration?: number;
  maxDuration?: number;
  hasError?: boolean;
}

export interface TestResultPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'testName' | 'status' | 'duration' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TestResultWithReport extends TestResult {
  report: {
    id: string;
    blockchain: string;
    testSuite: string;
    timestamp: Date;
  };
}

// Insert a new test result
export async function insertTestResult(
  testResultData: NewTestResult
): Promise<TestResult> {
  const [insertedTestResult] = await db
    .insert(testResults)
    .values(testResultData)
    .returning();

  if (!insertedTestResult) {
    throw new Error('Failed to insert test result');
  }

  return insertedTestResult;
}

// Insert multiple test results in a transaction
export async function insertTestResults(
  testResultsData: NewTestResult[]
): Promise<TestResult[]> {
  if (testResultsData.length === 0) {
    return [];
  }

  const insertedTestResults = await db
    .insert(testResults)
    .values(testResultsData)
    .returning();

  return insertedTestResults;
}

// Get a single test result by ID
export async function getTestResultById(
  id: string
): Promise<TestResult | null> {
  const [testResult] = await db
    .select()
    .from(testResults)
    .where(eq(testResults.id, id))
    .limit(1);

  return testResult || null;
}

// Get test results with filtering, sorting, and pagination
export async function getTestResults(
  filters: TestResultFilters = {},
  pagination: TestResultPaginationOptions = {}
): Promise<{
  data: TestResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const {
    reportId,
    testName,
    status,
    search,
    minDuration,
    maxDuration,
    hasError,
  } = filters;

  const {
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = pagination;

  // Build where conditions
  const conditions = [];

  if (reportId) {
    conditions.push(eq(testResults.reportId, reportId));
  }

  if (testName) {
    conditions.push(like(testResults.testName, `%${testName}%`));
  }

  if (status) {
    conditions.push(eq(testResults.status, status));
  }

  if (search) {
    // Search across test name, error message, and details
    conditions.push(
      or(
        like(testResults.testName, `%${search}%`),
        like(testResults.errorMessage, `%${search}%`),
        sql`${testResults.details}::text ILIKE ${`%${search}%`}`
      )
    );
  }

  if (minDuration !== undefined) {
    conditions.push(gte(testResults.duration, minDuration));
  }

  if (maxDuration !== undefined) {
    conditions.push(lte(testResults.duration, maxDuration));
  }

  if (hasError !== undefined) {
    if (hasError) {
      conditions.push(
        sql`${testResults.errorMessage} IS NOT NULL AND ${testResults.errorMessage} != ''`
      );
    } else {
      conditions.push(
        sql`${testResults.errorMessage} IS NULL OR ${testResults.errorMessage} = ''`
      );
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Build sort clause
  const validSortColumns = {
    testName: testResults.testName,
    status: testResults.status,
    duration: testResults.duration,
    createdAt: testResults.createdAt,
  } as const;

  const sortColumn =
    validSortColumns[sortBy as keyof typeof validSortColumns] ||
    testResults.createdAt;
  const orderClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

  // Calculate offset
  const offset = (page - 1) * limit;

  // Execute queries in parallel
  const [data, totalResult] = await Promise.all([
    // Get paginated data
    db
      .select()
      .from(testResults)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset),

    // Get total count
    db.select({ count: count() }).from(testResults).where(whereClause),
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

// Get test results with report information
export async function getTestResultsWithReports(
  filters: TestResultFilters = {},
  pagination: TestResultPaginationOptions = {}
): Promise<{
  data: TestResultWithReport[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const {
    reportId,
    testName,
    status,
    search,
    minDuration,
    maxDuration,
    hasError,
  } = filters;

  const {
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = pagination;

  // Build where conditions
  const conditions = [];

  if (reportId) {
    conditions.push(eq(testResults.reportId, reportId));
  }

  if (testName) {
    conditions.push(like(testResults.testName, `%${testName}%`));
  }

  if (status) {
    conditions.push(eq(testResults.status, status));
  }

  if (search) {
    conditions.push(
      or(
        like(testResults.testName, `%${search}%`),
        like(testResults.errorMessage, `%${search}%`),
        sql`${testResults.details}::text ILIKE ${`%${search}%`}`,
        like(reports.blockchain, `%${search}%`),
        like(reports.testSuite, `%${search}%`)
      )
    );
  }

  if (minDuration !== undefined) {
    conditions.push(gte(testResults.duration, minDuration));
  }

  if (maxDuration !== undefined) {
    conditions.push(lte(testResults.duration, maxDuration));
  }

  if (hasError !== undefined) {
    if (hasError) {
      conditions.push(
        sql`${testResults.errorMessage} IS NOT NULL AND ${testResults.errorMessage} != ''`
      );
    } else {
      conditions.push(
        sql`${testResults.errorMessage} IS NULL OR ${testResults.errorMessage} = ''`
      );
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Build sort clause - handle report fields
  let orderClause;
  if (
    sortBy === 'createdAt' ||
    sortBy === 'testName' ||
    sortBy === 'status' ||
    sortBy === 'duration'
  ) {
    const sortColumn = testResults[sortBy];
    orderClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
  } else {
    // Default to createdAt if invalid sortBy
    orderClause =
      sortOrder === 'asc'
        ? asc(testResults.createdAt)
        : desc(testResults.createdAt);
  }

  // Calculate offset
  const offset = (page - 1) * limit;

  // Execute complex query with report information
  const query = db
    .select({
      // Test result fields
      id: testResults.id,
      reportId: testResults.reportId,
      testName: testResults.testName,
      status: testResults.status,
      duration: testResults.duration,
      errorMessage: testResults.errorMessage,
      details: testResults.details,
      createdAt: testResults.createdAt,
      // Report fields
      report: {
        id: reports.id,
        blockchain: reports.blockchain,
        testSuite: reports.testSuite,
        timestamp: reports.timestamp,
      },
    })
    .from(testResults)
    .innerJoin(reports, eq(testResults.reportId, reports.id))
    .where(whereClause)
    .orderBy(orderClause)
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalQuery = db
    .select({ count: count() })
    .from(testResults)
    .innerJoin(reports, eq(testResults.reportId, reports.id))
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

// Get test results by report ID
export async function getTestResultsByReportId(
  reportId: string,
  limit: number = 1000
): Promise<TestResult[]> {
  return db
    .select()
    .from(testResults)
    .where(eq(testResults.reportId, reportId))
    .orderBy(asc(testResults.testName))
    .limit(limit);
}

// Get failed test results
export async function getFailedTestResults(
  limit: number = 100,
  reportId?: string
): Promise<TestResult[]> {
  const conditions = [eq(testResults.status, 'fail')];

  if (reportId) {
    conditions.push(eq(testResults.reportId, reportId));
  }

  return db
    .select()
    .from(testResults)
    .where(and(...conditions))
    .orderBy(desc(testResults.createdAt))
    .limit(limit);
}

// Get test results by status
export async function getTestResultsByStatus(
  status: string,
  limit: number = 100
): Promise<TestResult[]> {
  return db
    .select()
    .from(testResults)
    .where(eq(testResults.status, status))
    .orderBy(desc(testResults.createdAt))
    .limit(limit);
}

// Get slowest test results
export async function getSlowestTestResults(
  limit: number = 50,
  reportId?: string
): Promise<TestResult[]> {
  const conditions = [];

  if (reportId) {
    conditions.push(eq(testResults.reportId, reportId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select()
    .from(testResults)
    .where(whereClause)
    .orderBy(desc(testResults.duration))
    .limit(limit);
}

// Update test result status
export async function updateTestResultStatus(
  id: string,
  status: string,
  errorMessage?: string
): Promise<TestResult | null> {
  const updateData: Partial<NewTestResult> = { status };

  if (errorMessage !== undefined) {
    updateData.errorMessage = errorMessage;
  }

  const [updatedTestResult] = await db
    .update(testResults)
    .set(updateData)
    .where(eq(testResults.id, id))
    .returning();

  return updatedTestResult || null;
}

// Delete test results by report ID
export async function deleteTestResultsByReportId(
  reportId: string
): Promise<number> {
  const result = await db
    .delete(testResults)
    .where(eq(testResults.reportId, reportId))
    .returning({ id: testResults.id });

  return result.length;
}

// Delete multiple test results
export async function deleteTestResults(ids: string[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const result = await db
    .delete(testResults)
    .where(inArray(testResults.id, ids))
    .returning({ id: testResults.id });

  return result.length;
}

// Get test result statistics for a report
export async function getTestResultStats(reportId: string): Promise<{
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  averageDuration: number;
  totalDuration: number;
}> {
  const [stats] = await db
    .select({
      total: count(),
      passed: sql<number>`COUNT(CASE WHEN ${testResults.status} = 'pass' THEN 1 END)::int`,
      failed: sql<number>`COUNT(CASE WHEN ${testResults.status} = 'fail' THEN 1 END)::int`,
      skipped: sql<number>`COUNT(CASE WHEN ${testResults.status} = 'skip' THEN 1 END)::int`,
      averageDuration: sql<number>`COALESCE(AVG(${testResults.duration}), 0)::int`,
      totalDuration: sql<number>`COALESCE(SUM(${testResults.duration}), 0)::int`,
    })
    .from(testResults)
    .where(eq(testResults.reportId, reportId));

  return (
    stats || {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      averageDuration: 0,
      totalDuration: 0,
    }
  );
}

// Get unique test names
export async function getUniqueTestNames(
  limit: number = 1000
): Promise<string[]> {
  const result = await db
    .selectDistinct({ testName: testResults.testName })
    .from(testResults)
    .orderBy(asc(testResults.testName))
    .limit(limit);

  return result.map(r => r.testName);
}
