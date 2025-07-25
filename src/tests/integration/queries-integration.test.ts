// Integration test for database queries
// Tests the actual database operations with real data

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  insertReport,
  getReportById,
  getReports,
  getUniqueBlockchains,
} from '../../db/queries/reports';
import {
  insertTestResult,
  getTestResultsByReportId,
  getTestResultStats,
} from '../../db/queries/testResults';
import { getDashboardSummary } from '../../db/queries/analytics';
import { performFullTextSearch } from '../../db/queries/search';
import type { NewReport, NewTestResult } from '../../db/schema';

// Helper function to create test report
function createTestReport(overrides: Partial<NewReport> = {}): NewReport {
  return {
    blockchain: 'ethereum',
    testSuite: 'smoke-tests',
    status: 'pass',
    duration: 5000,
    metadata: { version: '1.0.0', environment: 'test' },
    ...overrides,
  };
}

// Helper function to create test result
function createTestResult(
  reportId: string,
  overrides: Partial<NewTestResult> = {}
): NewTestResult {
  return {
    reportId,
    testName: 'test-balance-consistency',
    status: 'pass',
    duration: 1000,
    errorMessage: null,
    details: { assertions: 5, passed: 5 },
    ...overrides,
  };
}

describe('Database Integration Tests', () => {
  let testReportId: string;

  it('should insert and retrieve a report', async () => {
    const reportData = createTestReport();
    const insertedReport = await insertReport(reportData);

    expect(insertedReport).toBeDefined();
    expect(insertedReport.id).toBeDefined();
    expect(insertedReport.blockchain).toBe(reportData.blockchain);
    expect(insertedReport.testSuite).toBe(reportData.testSuite);
    expect(insertedReport.status).toBe(reportData.status);

    testReportId = insertedReport.id;

    // Retrieve the report
    const retrievedReport = await getReportById(testReportId);
    expect(retrievedReport).toBeDefined();
    expect(retrievedReport?.id).toBe(testReportId);
  });

  it('should insert test results and get statistics', async () => {
    if (!testReportId) {
      const report = await insertReport(createTestReport());
      testReportId = report.id;
    }

    // Insert test results with different statuses
    const testResults = [
      createTestResult(testReportId, {
        testName: 'test-1',
        status: 'pass',
        duration: 1000,
      }),
      createTestResult(testReportId, {
        testName: 'test-2',
        status: 'fail',
        duration: 2000,
        errorMessage: 'Test failed',
      }),
      createTestResult(testReportId, {
        testName: 'test-3',
        status: 'skip',
        duration: 0,
      }),
    ];

    for (const testResult of testResults) {
      await insertTestResult(testResult);
    }

    // Get test results by report ID
    const reportTestResults = await getTestResultsByReportId(testReportId);
    expect(reportTestResults.length).toBe(3);
    expect(reportTestResults.every(tr => tr.reportId === testReportId)).toBe(
      true
    );

    // Get statistics
    const stats = await getTestResultStats(testReportId);
    expect(stats.total).toBe(3);
    expect(stats.passed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.skipped).toBe(1);
    expect(stats.totalDuration).toBe(3000);
  });

  it('should get reports with filtering', async () => {
    // Insert multiple test reports
    const reports = [
      createTestReport({ blockchain: 'ethereum', status: 'pass' }),
      createTestReport({ blockchain: 'polkadot', status: 'fail' }),
      createTestReport({ blockchain: 'ethereum', status: 'pass' }),
    ];

    for (const report of reports) {
      await insertReport(report);
    }

    // Test filtering by blockchain
    const ethereumReports = await getReports(
      { blockchain: 'ethereum' },
      { limit: 10 }
    );

    expect(ethereumReports.data.length).toBeGreaterThanOrEqual(2);
    expect(ethereumReports.data.every(r => r.blockchain === 'ethereum')).toBe(
      true
    );
  });

  it('should get unique blockchains', async () => {
    const blockchains = await getUniqueBlockchains();
    expect(Array.isArray(blockchains)).toBe(true);
    expect(blockchains.length).toBeGreaterThan(0);
    expect(blockchains).toContain('ethereum');
  });

  it('should get dashboard summary', async () => {
    const summary = await getDashboardSummary('day');

    expect(summary).toBeDefined();
    expect(typeof summary.totalReports).toBe('number');
    expect(typeof summary.totalTests).toBe('number');
    expect(typeof summary.successRate).toBe('number');
    expect(typeof summary.averageDuration).toBe('number');
    expect(summary.successRate).toBeGreaterThanOrEqual(0);
    expect(summary.successRate).toBeLessThanOrEqual(100);
  });

  it('should perform full-text search', async () => {
    const searchResult = await performFullTextSearch({
      query: 'ethereum',
      includeReports: true,
      includeTestResults: true,
    });

    expect(searchResult).toBeDefined();
    expect(typeof searchResult.total).toBe('number');
    expect(typeof searchResult.searchTime).toBe('number');
    expect(Array.isArray(searchResult.results)).toBe(true);
  });
});
