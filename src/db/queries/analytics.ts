// Analytics and aggregation query functions
// Implements complex queries for dashboard analytics and reporting

import {
  eq,
  desc,
  asc,
  and,
  or,
  gte,
  lte,
  sql,
  count,
  avg,
  sum,
  max,
  min,
} from 'drizzle-orm';
import { db } from '../connection';
import { reports, testResults } from '../schema';

// Types for analytics data
export interface DashboardSummary {
  totalReports: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  averageDuration: number;
  successRate: number;
  recentFailures: number;
  activeBlockchains: number;
}

export interface BlockchainStats {
  blockchain: string;
  totalReports: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  successRate: number;
  averageDuration: number;
  lastReportTime: Date | null;
}

export interface TimeSeriesData {
  date: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  successRate: number;
  averageDuration: number;
}

export interface TestFailurePattern {
  testName: string;
  failureCount: number;
  totalRuns: number;
  failureRate: number;
  lastFailure: Date | null;
  commonErrors: string[];
}

export interface PerformanceMetrics {
  slowestTests: Array<{
    testName: string;
    averageDuration: number;
    maxDuration: number;
    runCount: number;
  }>;
  fastestTests: Array<{
    testName: string;
    averageDuration: number;
    minDuration: number;
    runCount: number;
  }>;
  durationTrends: TimeSeriesData[];
}

// Get dashboard summary statistics
export async function getDashboardSummary(
  timeframe: 'hour' | 'day' | 'week' | 'month' = 'day'
): Promise<DashboardSummary> {
  // Calculate time range
  const now = new Date();
  let since: Date;

  switch (timeframe) {
    case 'hour':
      since = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case 'day':
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  // Get report statistics
  const [reportStats] = await db
    .select({
      totalReports: count(),
      averageDuration: sql<number>`COALESCE(AVG(${reports.duration}), 0)`,
      recentFailures: sql<number>`COUNT(CASE WHEN ${reports.status} = 'fail' THEN 1 END)`,
      activeBlockchains: sql<number>`COUNT(DISTINCT ${reports.blockchain})`,
    })
    .from(reports)
    .where(gte(reports.timestamp, since));

  // Get test result statistics
  const [testStats] = await db
    .select({
      totalTests: count(),
      passedTests: sql<number>`COUNT(CASE WHEN ${testResults.status} = 'pass' THEN 1 END)`,
      failedTests: sql<number>`COUNT(CASE WHEN ${testResults.status} = 'fail' THEN 1 END)`,
      skippedTests: sql<number>`COUNT(CASE WHEN ${testResults.status} = 'skip' THEN 1 END)`,
    })
    .from(testResults)
    .innerJoin(reports, eq(testResults.reportId, reports.id))
    .where(gte(reports.timestamp, since));

  const totalTests = testStats?.totalTests || 0;
  const passedTests = testStats?.passedTests || 0;
  const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

  return {
    totalReports: reportStats?.totalReports || 0,
    totalTests,
    passedTests,
    failedTests: testStats?.failedTests || 0,
    skippedTests: testStats?.skippedTests || 0,
    averageDuration: Math.round(reportStats?.averageDuration || 0),
    successRate: Math.round(successRate * 100) / 100,
    recentFailures: reportStats?.recentFailures || 0,
    activeBlockchains: reportStats?.activeBlockchains || 0,
  };
}

// Get statistics by blockchain
export async function getBlockchainStats(
  timeframe: 'day' | 'week' | 'month' = 'week'
): Promise<BlockchainStats[]> {
  // Calculate time range
  const now = new Date();
  let since: Date;

  switch (timeframe) {
    case 'day':
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  const stats = await db
    .select({
      blockchain: reports.blockchain,
      totalReports: count(reports.id),
      totalTests: sql<number>`COALESCE(COUNT(${testResults.id}), 0)`,
      passedTests: sql<number>`COALESCE(COUNT(CASE WHEN ${testResults.status} = 'pass' THEN 1 END), 0)`,
      failedTests: sql<number>`COALESCE(COUNT(CASE WHEN ${testResults.status} = 'fail' THEN 1 END), 0)`,
      skippedTests: sql<number>`COALESCE(COUNT(CASE WHEN ${testResults.status} = 'skip' THEN 1 END), 0)`,
      averageDuration: sql<number>`COALESCE(AVG(${reports.duration}), 0)`,
      lastReportTime: max(reports.timestamp),
    })
    .from(reports)
    .leftJoin(testResults, eq(reports.id, testResults.reportId))
    .where(gte(reports.timestamp, since))
    .groupBy(reports.blockchain)
    .orderBy(desc(count(reports.id)));

  return stats.map(stat => ({
    blockchain: stat.blockchain,
    totalReports: stat.totalReports,
    totalTests: stat.totalTests,
    passedTests: stat.passedTests,
    failedTests: stat.failedTests,
    skippedTests: stat.skippedTests,
    successRate:
      stat.totalTests > 0
        ? Math.round((stat.passedTests / stat.totalTests) * 10000) / 100
        : 0,
    averageDuration: Math.round(stat.averageDuration),
    lastReportTime: stat.lastReportTime,
  }));
}

// Get time series data for trends
export async function getTimeSeriesData(
  days: number = 7,
  blockchain?: string
): Promise<TimeSeriesData[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Build conditions
  const conditions = [gte(reports.timestamp, since)];
  if (blockchain) {
    conditions.push(eq(reports.blockchain, blockchain));
  }

  const data = await db
    .select({
      date: sql<string>`DATE(${reports.timestamp})`,
      totalTests: sql<number>`COALESCE(COUNT(${testResults.id}), 0)`,
      passedTests: sql<number>`COALESCE(COUNT(CASE WHEN ${testResults.status} = 'pass' THEN 1 END), 0)`,
      failedTests: sql<number>`COALESCE(COUNT(CASE WHEN ${testResults.status} = 'fail' THEN 1 END), 0)`,
      skippedTests: sql<number>`COALESCE(COUNT(CASE WHEN ${testResults.status} = 'skip' THEN 1 END), 0)`,
      averageDuration: sql<number>`COALESCE(AVG(${reports.duration}), 0)`,
    })
    .from(reports)
    .leftJoin(testResults, eq(reports.id, testResults.reportId))
    .where(and(...conditions))
    .groupBy(sql`DATE(${reports.timestamp})`)
    .orderBy(sql`DATE(${reports.timestamp})`);

  return data.map(item => ({
    date: item.date,
    totalTests: item.totalTests,
    passedTests: item.passedTests,
    failedTests: item.failedTests,
    skippedTests: item.skippedTests,
    successRate:
      item.totalTests > 0
        ? Math.round((item.passedTests / item.totalTests) * 10000) / 100
        : 0,
    averageDuration: Math.round(item.averageDuration),
  }));
}

// Get test failure patterns
export async function getTestFailurePatterns(
  limit: number = 20,
  days: number = 30
): Promise<TestFailurePattern[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const patterns = await db
    .select({
      testName: testResults.testName,
      failureCount: sql<number>`COUNT(CASE WHEN ${testResults.status} = 'fail' THEN 1 END)`,
      totalRuns: count(),
      lastFailure: sql<Date | null>`MAX(CASE WHEN ${testResults.status} = 'fail' THEN ${reports.timestamp} END)`,
      // Get most common error messages (simplified)
      commonErrors: sql<
        string[]
      >`ARRAY_AGG(DISTINCT ${testResults.errorMessage}) FILTER (WHERE ${testResults.errorMessage} IS NOT NULL AND ${testResults.errorMessage} != '')`,
    })
    .from(testResults)
    .innerJoin(reports, eq(testResults.reportId, reports.id))
    .where(gte(reports.timestamp, since))
    .groupBy(testResults.testName)
    .having(sql`COUNT(CASE WHEN ${testResults.status} = 'fail' THEN 1 END) > 0`)
    .orderBy(
      sql`COUNT(CASE WHEN ${testResults.status} = 'fail' THEN 1 END) DESC`
    )
    .limit(limit);

  return patterns.map(pattern => ({
    testName: pattern.testName,
    failureCount: pattern.failureCount,
    totalRuns: pattern.totalRuns,
    failureRate:
      pattern.totalRuns > 0
        ? Math.round((pattern.failureCount / pattern.totalRuns) * 10000) / 100
        : 0,
    lastFailure: pattern.lastFailure,
    commonErrors: pattern.commonErrors || [],
  }));
}

// Get performance metrics
export async function getPerformanceMetrics(
  limit: number = 10,
  days: number = 7
): Promise<PerformanceMetrics> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get slowest tests
  const slowestTests = await db
    .select({
      testName: testResults.testName,
      averageDuration: sql<number>`AVG(${testResults.duration})`,
      maxDuration: max(testResults.duration),
      runCount: count(),
    })
    .from(testResults)
    .innerJoin(reports, eq(testResults.reportId, reports.id))
    .where(gte(reports.timestamp, since))
    .groupBy(testResults.testName)
    .orderBy(sql`AVG(${testResults.duration}) DESC`)
    .limit(limit);

  // Get fastest tests
  const fastestTests = await db
    .select({
      testName: testResults.testName,
      averageDuration: sql<number>`AVG(${testResults.duration})`,
      minDuration: min(testResults.duration),
      runCount: count(),
    })
    .from(testResults)
    .innerJoin(reports, eq(testResults.reportId, reports.id))
    .where(gte(reports.timestamp, since))
    .groupBy(testResults.testName)
    .orderBy(sql`AVG(${testResults.duration}) ASC`)
    .limit(limit);

  // Get duration trends
  const durationTrends = await getTimeSeriesData(days);

  return {
    slowestTests: slowestTests.map(test => ({
      testName: test.testName,
      averageDuration: Math.round(test.averageDuration),
      maxDuration: test.maxDuration ?? 0,
      runCount: test.runCount,
    })),
    fastestTests: fastestTests.map(test => ({
      testName: test.testName,
      averageDuration: Math.round(test.averageDuration),
      minDuration: test.minDuration ?? 0,
      runCount: test.runCount,
    })),
    durationTrends,
  };
}

// Get recent activity summary
export async function getRecentActivity(
  hours: number = 24,
  limit: number = 50
): Promise<{
  recentReports: Array<{
    id: string;
    blockchain: string;
    testSuite: string;
    status: string;
    timestamp: Date;
    testCount: number;
    duration: number;
  }>;
  recentFailures: Array<{
    testName: string;
    blockchain: string;
    errorMessage: string | null;
    timestamp: Date;
  }>;
}> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  // Get recent reports with test counts
  const recentReports = await db
    .select({
      id: reports.id,
      blockchain: reports.blockchain,
      testSuite: reports.testSuite,
      status: reports.status,
      timestamp: reports.timestamp,
      duration: reports.duration,
      testCount: sql<number>`COALESCE(COUNT(${testResults.id}), 0)`,
    })
    .from(reports)
    .leftJoin(testResults, eq(reports.id, testResults.reportId))
    .where(gte(reports.timestamp, since))
    .groupBy(reports.id)
    .orderBy(desc(reports.timestamp))
    .limit(limit);

  // Get recent failures
  const recentFailures = await db
    .select({
      testName: testResults.testName,
      blockchain: reports.blockchain,
      errorMessage: testResults.errorMessage,
      timestamp: reports.timestamp,
    })
    .from(testResults)
    .innerJoin(reports, eq(testResults.reportId, reports.id))
    .where(and(gte(reports.timestamp, since), eq(testResults.status, 'fail')))
    .orderBy(desc(reports.timestamp))
    .limit(limit);

  return {
    recentReports,
    recentFailures,
  };
}

// Get system health metrics
export async function getSystemHealthMetrics(): Promise<{
  overallHealth: 'healthy' | 'warning' | 'critical';
  metrics: {
    recentSuccessRate: number;
    averageResponseTime: number;
    activeBlockchains: number;
    reportsLast24h: number;
    failuresLast24h: number;
  };
  alerts: Array<{
    type: 'warning' | 'critical';
    message: string;
    blockchain?: string;
  }>;
}> {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const lastHour = new Date(Date.now() - 60 * 60 * 1000);

  // Get basic metrics
  const [metrics] = await db
    .select({
      totalTests: sql<number>`COALESCE(COUNT(${testResults.id}), 0)`,
      passedTests: sql<number>`COALESCE(COUNT(CASE WHEN ${testResults.status} = 'pass' THEN 1 END), 0)`,
      averageResponseTime: sql<number>`COALESCE(AVG(${reports.duration}), 0)`,
      activeBlockchains: sql<number>`COUNT(DISTINCT ${reports.blockchain})`,
      reportsLast24h: sql<number>`COUNT(DISTINCT ${reports.id})`,
      failuresLast24h: sql<number>`COUNT(CASE WHEN ${testResults.status} = 'fail' THEN 1 END)`,
    })
    .from(reports)
    .leftJoin(testResults, eq(reports.id, testResults.reportId))
    .where(gte(reports.timestamp, last24h));

  const recentSuccessRate =
    metrics && metrics.totalTests > 0
      ? (metrics.passedTests / metrics.totalTests) * 100
      : 100;

  // Check for alerts
  const alerts: Array<{
    type: 'warning' | 'critical';
    message: string;
    blockchain?: string;
  }> = [];

  // Check success rate
  if (recentSuccessRate < 50) {
    alerts.push({
      type: 'critical',
      message: `Critical: Success rate is ${recentSuccessRate.toFixed(1)}% in the last 24 hours`,
    });
  } else if (recentSuccessRate < 80) {
    alerts.push({
      type: 'warning',
      message: `Warning: Success rate is ${recentSuccessRate.toFixed(1)}% in the last 24 hours`,
    });
  }

  // Check for recent activity
  const [recentActivity] = await db
    .select({
      recentReports: count(),
    })
    .from(reports)
    .where(gte(reports.timestamp, lastHour));

  if (recentActivity && recentActivity.recentReports === 0) {
    alerts.push({
      type: 'warning',
      message: 'No reports received in the last hour',
    });
  }

  // Determine overall health
  let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (alerts.some(alert => alert.type === 'critical')) {
    overallHealth = 'critical';
  } else if (alerts.length > 0) {
    overallHealth = 'warning';
  }

  return {
    overallHealth,
    metrics: {
      recentSuccessRate: Math.round(recentSuccessRate * 100) / 100,
      averageResponseTime: Math.round(metrics?.averageResponseTime || 0),
      activeBlockchains: metrics?.activeBlockchains || 0,
      reportsLast24h: metrics?.reportsLast24h || 0,
      failuresLast24h: metrics?.failuresLast24h || 0,
    },
    alerts,
  };
}
