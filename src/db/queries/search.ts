// Full-text search query functions
// Implements advanced search capabilities across reports and test results

import { eq, desc, asc, and, or, like, sql, count, ilike } from 'drizzle-orm';
import { db } from '../connection';
import { reports, testResults, type Report, type TestResult } from '../schema';

// Types for search functionality
export interface SearchFilters {
  query: string;
  blockchain?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  includeReports?: boolean;
  includeTestResults?: boolean;
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'timestamp' | 'duration';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  type: 'report' | 'test_result';
  id: string;
  title: string;
  description: string;
  blockchain?: string;
  status: string;
  timestamp: Date;
  relevanceScore: number;
  highlights: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchTime: number;
}

// Perform full-text search across reports and test results
export async function performFullTextSearch(
  filters: SearchFilters,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const startTime = Date.now();

  const {
    query,
    blockchain,
    status,
    dateFrom,
    dateTo,
    includeReports = true,
    includeTestResults = true,
  } = filters;

  const {
    page = 1,
    limit = 50,
    sortBy = 'relevance',
    sortOrder = 'desc',
  } = options;

  if (!query.trim()) {
    return {
      results: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      searchTime: Date.now() - startTime,
    };
  }

  const searchTerms = query
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0);
  const offset = (page - 1) * limit;

  const results: SearchResult[] = [];
  let totalCount = 0;

  // Search in reports if enabled
  if (includeReports) {
    const reportResults = await searchReports(
      searchTerms,
      { blockchain, status, dateFrom, dateTo },
      { limit: Math.ceil(limit / 2), offset: Math.floor(offset / 2) }
    );

    results.push(...reportResults.results);
    totalCount += reportResults.total;
  }

  // Search in test results if enabled
  if (includeTestResults) {
    const testResultResults = await searchTestResults(
      searchTerms,
      { blockchain, status, dateFrom, dateTo },
      { limit: Math.ceil(limit / 2), offset: Math.floor(offset / 2) }
    );

    results.push(...testResultResults.results);
    totalCount += testResultResults.total;
  }

  // Sort results by relevance or other criteria
  results.sort((a, b) => {
    switch (sortBy) {
      case 'relevance':
        return sortOrder === 'desc'
          ? b.relevanceScore - a.relevanceScore
          : a.relevanceScore - b.relevanceScore;
      case 'timestamp':
        return sortOrder === 'desc'
          ? b.timestamp.getTime() - a.timestamp.getTime()
          : a.timestamp.getTime() - b.timestamp.getTime();
      default:
        return sortOrder === 'desc'
          ? b.relevanceScore - a.relevanceScore
          : a.relevanceScore - b.relevanceScore;
    }
  });

  // Apply pagination to combined results
  const paginatedResults = results.slice(0, limit);
  const totalPages = Math.ceil(totalCount / limit);

  return {
    results: paginatedResults,
    total: totalCount,
    page,
    limit,
    totalPages,
    searchTime: Date.now() - startTime,
  };
}

// Search specifically in reports
async function searchReports(
  searchTerms: string[],
  filters: {
    blockchain?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  },
  pagination: { limit: number; offset: number }
): Promise<{ results: SearchResult[]; total: number }> {
  const { blockchain, status, dateFrom, dateTo } = filters;
  const { limit, offset } = pagination;

  // Build search conditions
  const searchConditions = searchTerms.map(term =>
    or(
      ilike(reports.blockchain, `%${term}%`),
      ilike(reports.testSuite, `%${term}%`),
      sql`${reports.metadata}::text ILIKE ${`%${term}%`}`
    )
  );

  const conditions = [and(...searchConditions)];

  if (blockchain) {
    conditions.push(eq(reports.blockchain, blockchain));
  }

  if (status) {
    conditions.push(eq(reports.status, status));
  }

  if (dateFrom) {
    conditions.push(sql`${reports.timestamp} >= ${dateFrom}`);
  }

  if (dateTo) {
    conditions.push(sql`${reports.timestamp} <= ${dateTo}`);
  }

  const whereClause = and(...conditions);

  // Calculate relevance score based on matches
  const relevanceScore = sql<number>`
    (CASE WHEN ${reports.blockchain} ILIKE ${`%${searchTerms[0]}%`} THEN 10 ELSE 0 END) +
    (CASE WHEN ${reports.testSuite} ILIKE ${`%${searchTerms[0]}%`} THEN 8 ELSE 0 END) +
    (CASE WHEN ${reports.metadata}::text ILIKE ${`%${searchTerms[0]}%`} THEN 5 ELSE 0 END)
  `;

  // Get search results
  const searchResults = await db
    .select({
      id: reports.id,
      blockchain: reports.blockchain,
      testSuite: reports.testSuite,
      status: reports.status,
      timestamp: reports.timestamp,
      duration: reports.duration,
      metadata: reports.metadata,
      relevanceScore,
    })
    .from(reports)
    .where(whereClause)
    .orderBy(desc(relevanceScore))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ total: count() })
    .from(reports)
    .where(whereClause);

  const total = countResult?.total || 0;

  // Transform to SearchResult format
  const results: SearchResult[] = searchResults.map(report => ({
    type: 'report' as const,
    id: report.id,
    title: `${report.blockchain} - ${report.testSuite}`,
    description: `Report from ${report.timestamp.toISOString()} with status ${report.status}`,
    blockchain: report.blockchain,
    status: report.status,
    timestamp: report.timestamp,
    relevanceScore: report.relevanceScore,
    highlights: generateHighlights(searchTerms, [
      report.blockchain,
      report.testSuite,
      JSON.stringify(report.metadata),
    ]),
  }));

  return { results, total };
}

// Search specifically in test results
async function searchTestResults(
  searchTerms: string[],
  filters: {
    blockchain?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  },
  pagination: { limit: number; offset: number }
): Promise<{ results: SearchResult[]; total: number }> {
  const { blockchain, status, dateFrom, dateTo } = filters;
  const { limit, offset } = pagination;

  // Build search conditions
  const searchConditions = searchTerms.map(term =>
    or(
      ilike(testResults.testName, `%${term}%`),
      ilike(testResults.errorMessage, `%${term}%`),
      sql`${testResults.details}::text ILIKE ${`%${term}%`}`,
      ilike(reports.blockchain, `%${term}%`)
    )
  );

  const conditions = [and(...searchConditions)];

  if (blockchain) {
    conditions.push(eq(reports.blockchain, blockchain));
  }

  if (status) {
    conditions.push(eq(testResults.status, status));
  }

  if (dateFrom) {
    conditions.push(sql`${reports.timestamp} >= ${dateFrom}`);
  }

  if (dateTo) {
    conditions.push(sql`${reports.timestamp} <= ${dateTo}`);
  }

  const whereClause = and(...conditions);

  // Calculate relevance score
  const relevanceScore = sql<number>`
    (CASE WHEN ${testResults.testName} ILIKE ${`%${searchTerms[0]}%`} THEN 15 ELSE 0 END) +
    (CASE WHEN ${testResults.errorMessage} ILIKE ${`%${searchTerms[0]}%`} THEN 12 ELSE 0 END) +
    (CASE WHEN ${testResults.details}::text ILIKE ${`%${searchTerms[0]}%`} THEN 8 ELSE 0 END) +
    (CASE WHEN ${reports.blockchain} ILIKE ${`%${searchTerms[0]}%`} THEN 5 ELSE 0 END)
  `;

  // Get search results with report information
  const searchResults = await db
    .select({
      id: testResults.id,
      testName: testResults.testName,
      status: testResults.status,
      duration: testResults.duration,
      errorMessage: testResults.errorMessage,
      details: testResults.details,
      blockchain: reports.blockchain,
      timestamp: reports.timestamp,
      relevanceScore,
    })
    .from(testResults)
    .innerJoin(reports, eq(testResults.reportId, reports.id))
    .where(whereClause)
    .orderBy(desc(relevanceScore))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ total: count() })
    .from(testResults)
    .innerJoin(reports, eq(testResults.reportId, reports.id))
    .where(whereClause);

  const total = countResult?.total || 0;

  // Transform to SearchResult format
  const results: SearchResult[] = searchResults.map(testResult => ({
    type: 'test_result' as const,
    id: testResult.id,
    title: testResult.testName,
    description:
      testResult.errorMessage || `Test result with status ${testResult.status}`,
    blockchain: testResult.blockchain,
    status: testResult.status,
    timestamp: testResult.timestamp,
    relevanceScore: testResult.relevanceScore,
    highlights: generateHighlights(searchTerms, [
      testResult.testName,
      testResult.errorMessage || '',
      JSON.stringify(testResult.details),
    ]),
  }));

  return { results, total };
}

// Generate highlighted text snippets
function generateHighlights(searchTerms: string[], texts: string[]): string[] {
  const highlights: string[] = [];

  for (const text of texts) {
    if (!text) continue;

    for (const term of searchTerms) {
      const regex = new RegExp(`(.{0,50})(${term})(.{0,50})`, 'gi');
      const matches = text.match(regex);

      if (matches) {
        highlights.push(...matches.slice(0, 2)); // Limit to 2 highlights per text
      }
    }
  }

  return highlights.slice(0, 5); // Limit total highlights
}

// Quick search for autocomplete/suggestions
export async function getSearchSuggestions(
  query: string,
  limit: number = 10
): Promise<{
  blockchains: string[];
  testSuites: string[];
  testNames: string[];
}> {
  if (!query.trim() || query.length < 2) {
    return {
      blockchains: [],
      testSuites: [],
      testNames: [],
    };
  }

  const searchPattern = `%${query}%`;

  // Get blockchain suggestions
  const blockchainSuggestions = await db
    .selectDistinct({ blockchain: reports.blockchain })
    .from(reports)
    .where(ilike(reports.blockchain, searchPattern))
    .orderBy(asc(reports.blockchain))
    .limit(limit);

  // Get test suite suggestions
  const testSuiteSuggestions = await db
    .selectDistinct({ testSuite: reports.testSuite })
    .from(reports)
    .where(ilike(reports.testSuite, searchPattern))
    .orderBy(asc(reports.testSuite))
    .limit(limit);

  // Get test name suggestions
  const testNameSuggestions = await db
    .selectDistinct({ testName: testResults.testName })
    .from(testResults)
    .where(ilike(testResults.testName, searchPattern))
    .orderBy(asc(testResults.testName))
    .limit(limit);

  return {
    blockchains: blockchainSuggestions.map(s => s.blockchain),
    testSuites: testSuiteSuggestions.map(s => s.testSuite),
    testNames: testNameSuggestions.map(s => s.testName),
  };
}

// Advanced search with complex filters
export async function performAdvancedSearch(filters: {
  query?: string;
  blockchain?: string[];
  status?: string[];
  testName?: string;
  hasError?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  minDuration?: number;
  maxDuration?: number;
  sortBy?: 'relevance' | 'timestamp' | 'duration' | 'testName';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}): Promise<SearchResponse> {
  const startTime = Date.now();

  const {
    query,
    blockchain,
    status,
    testName,
    hasError,
    dateFrom,
    dateTo,
    minDuration,
    maxDuration,
    sortBy = 'relevance',
    sortOrder = 'desc',
    page = 1,
    limit = 50,
  } = filters;

  const offset = (page - 1) * limit;
  const conditions = [];

  // Text search conditions
  if (query && query.trim()) {
    const searchTerms = query.trim().split(/\s+/);
    const searchConditions = searchTerms.map(term =>
      or(
        ilike(testResults.testName, `%${term}%`),
        ilike(testResults.errorMessage, `%${term}%`),
        sql`${testResults.details}::text ILIKE ${`%${term}%`}`,
        ilike(reports.blockchain, `%${term}%`),
        ilike(reports.testSuite, `%${term}%`)
      )
    );
    conditions.push(and(...searchConditions));
  }

  // Filter conditions
  if (blockchain && blockchain.length > 0) {
    conditions.push(
      sql`${reports.blockchain} = ANY(${sql.raw(`ARRAY[${blockchain.map(b => `'${b}'`).join(',')}]`)})`
    );
  }

  if (status && status.length > 0) {
    conditions.push(
      sql`${testResults.status} = ANY(${sql.raw(`ARRAY[${status.map(s => `'${s}'`).join(',')}]`)})`
    );
  }

  if (testName) {
    conditions.push(ilike(testResults.testName, `%${testName}%`));
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

  if (dateFrom) {
    conditions.push(sql`${reports.timestamp} >= ${dateFrom}`);
  }

  if (dateTo) {
    conditions.push(sql`${reports.timestamp} <= ${dateTo}`);
  }

  if (minDuration !== undefined) {
    conditions.push(sql`${testResults.duration} >= ${minDuration}`);
  }

  if (maxDuration !== undefined) {
    conditions.push(sql`${testResults.duration} <= ${maxDuration}`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Build sort clause
  let orderClause;
  switch (sortBy) {
    case 'timestamp':
      orderClause =
        sortOrder === 'desc' ? desc(reports.timestamp) : asc(reports.timestamp);
      break;
    case 'duration':
      orderClause =
        sortOrder === 'desc'
          ? desc(testResults.duration)
          : asc(testResults.duration);
      break;
    case 'testName':
      orderClause =
        sortOrder === 'desc'
          ? desc(testResults.testName)
          : asc(testResults.testName);
      break;
    default: // relevance
      const relevanceScore = query
        ? sql<number>`
        (CASE WHEN ${testResults.testName} ILIKE ${`%${query}%`} THEN 15 ELSE 0 END) +
        (CASE WHEN ${testResults.errorMessage} ILIKE ${`%${query}%`} THEN 12 ELSE 0 END) +
        (CASE WHEN ${reports.blockchain} ILIKE ${`%${query}%`} THEN 5 ELSE 0 END)
      `
        : sql<number>`1`;
      orderClause =
        sortOrder === 'desc' ? desc(relevanceScore) : asc(relevanceScore);
      break;
  }

  // Execute search query
  const searchResults = await db
    .select({
      id: testResults.id,
      testName: testResults.testName,
      status: testResults.status,
      duration: testResults.duration,
      errorMessage: testResults.errorMessage,
      details: testResults.details,
      blockchain: reports.blockchain,
      testSuite: reports.testSuite,
      timestamp: reports.timestamp,
    })
    .from(testResults)
    .innerJoin(reports, eq(testResults.reportId, reports.id))
    .where(whereClause)
    .orderBy(orderClause)
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ total: count() })
    .from(testResults)
    .innerJoin(reports, eq(testResults.reportId, reports.id))
    .where(whereClause);

  const total = countResult?.total || 0;

  // Transform results
  const results: SearchResult[] = searchResults.map(result => ({
    type: 'test_result' as const,
    id: result.id,
    title: result.testName,
    description: result.errorMessage || `Test from ${result.testSuite}`,
    blockchain: result.blockchain,
    status: result.status,
    timestamp: result.timestamp,
    relevanceScore: 1, // Would calculate based on actual relevance
    highlights: query
      ? generateHighlights(query.split(/\s+/), [
          result.testName,
          result.errorMessage || '',
          JSON.stringify(result.details),
        ])
      : [],
  }));

  const totalPages = Math.ceil(total / limit);

  return {
    results,
    total,
    page,
    limit,
    totalPages,
    searchTime: Date.now() - startTime,
  };
}
