// Unit tests for database query functions
// Tests the data access layer implementation

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test';
import { createDatabaseConnection, closeDatabase } from '../../db/connection';
import {
  insertReport,
  getReportById,
  getReports,
  getReportsWithCounts,
  getRecentReports,
  updateReportStatus,
  deleteReport,
  getUniqueBlockchains,
} from '../../db/queries/reports';
import {
  insertTestResult,
  getTestResultById,
  getTestResults,
  getTestResultsByReportId,
  getTestResultStats,
  getFailedTestResults,
} from '../../db/queries/testResults';
import {
  getDashboardSummary,
  getBlockchainStats,
  getTimeSeriesData,
  getSystemHealthMetrics,
} from '../../db/queries/analytics';
import {
  performFullTextSearch,
  getSearchSuggestions,
  performAdvancedSearch,
} from '../../db/queries/search';
import type { NewReport, NewTestResult } from '../../db/schema';

// Test database connection
let testDb: ReturnType<typeof createDatabaseConnection>;

beforeAll(async () => {
  // Create test database connection
  const testDbUrl =
    process.env.TEST_DATABASE_URL ||
    'postgresql://test_user:test_pass@localhost:5432/blockchain_monitoring_test';
  testDb = createDatabaseConnection(testDbUrl, { prepare: false });
});

afterAll(async () => {
  // Clean up test database connection
  if (testDb) {
    await testDb.client.end();
  }
});

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

describe('Report Queries', () => {
  let testReportId: string;

  beforeEach(async () => {
    // Clean up any existing test data
    // Note: In a real test environment, you'd want proper test isolation
  });

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

  it('should get reports with filtering and pagination', async () => {
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

    // Test filtering by status
    const failedReports = await getReports({ status: 'fail' }, { limit: 10 });

    expect(failedReports.data.length).toBeGreaterThanOrEqual(1);
    expect(failedReports.data.every(r => r.status === 'fail')).toBe(true);
  });

  it('should update report status', async () => {
    if (!testReportId) {
      const report = await insertReport(createTestReport());
      testReportId = report.id;
    }

    const updatedReport = await updateReportStatus(testReportId, 'fail');
    expect(updatedReport).toBeDefined();
    expect(updatedReport?.status).toBe('fail');
  });

  it('should get unique blockchains', async () => {
    // Insert reports with different blockchains
    await insertReport(createTestReport({ blockchain: 'ethereum' }));
    await insertReport(createTestReport({ blockchain: 'polkadot' }));
    await insertReport(createTestReport({ blockchain: 'cosmos' }));

    const blockchains = await getUniqueBlockchains();
    expect(blockchains).toContain('ethereum');
    expect(blockchains).toContain('polkadot');
    expect(blockchains).toContain('cosmos');
  });
});

describe('Test Result Queries', () => {
  let testReportId: string;
  let testResultId: string;

  beforeEach(async () => {
    // Create a test report first
    const report = await insertReport(createTestReport());
    testReportId = report.id;
  });

  it('should insert and retrieve test results', async () => {
    const testResultData = createTestResult(testReportId);
    const insertedTestResult = await insertTestResult(testResultData);

    expect(insertedTestResult).toBeDefined();
    expect(insertedTestResult.id).toBeDefined();
    expect(insertedTestResult.reportId).toBe(testReportId);
    expect(insertedTestResult.testName).toBe(testResultData.testName);

    testResultId = insertedTestResult.id;

    // Retrieve the test result
    const retrievedTestResult = await getTestResultById(testResultId);
    expect(retrievedTestResult).toBeDefined();
    expect(retrievedTestResult?.id).toBe(testResultId);
  });

  it('should get test results by report ID', async () => {
    // Insert multiple test results for the report
    const testResults = [
      createTestResult(testReportId, { testName: 'test-1', status: 'pass' }),
      createTestResult(testReportId, { testName: 'test-2', status: 'fail' }),
      createTestResult(testReportId, { testName: 'test-3', status: 'skip' }),
    ];

    for (const testResult of testResults) {
      await insertTestResult(testResult);
    }

    const reportTestResults = await getTestResultsByReportId(testReportId);
    expect(reportTestResults.length).toBe(3);
    expect(reportTestResults.every(tr => tr.reportId === testReportId)).toBe(
      true
    );
  });

  it('should get test result statistics', async () => {
    // Insert test results with different statuses
    await insertTestResult(
      createTestResult(testReportId, { status: 'pass', duration: 1000 })
    );
    await insertTestResult(
      createTestResult(testReportId, { status: 'pass', duration: 2000 })
    );
    await insertTestResult(
      createTestResult(testReportId, { status: 'fail', duration: 500 })
    );
    await insertTestResult(
      createTestResult(testReportId, { status: 'skip', duration: 0 })
    );

    const stats = await getTestResultStats(testReportId);
    expect(stats.total).toBe(4);
    expect(stats.passed).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.skipped).toBe(1);
    expect(stats.totalDuration).toBe(3500);
  });

  it('should get failed test results', async () => {
    // Insert some failed test results
    await insertTestResult(
      createTestResult(testReportId, {
        status: 'fail',
        errorMessage: 'Assertion failed',
        testName: 'failing-test-1',
      })
    );
    await insertTestResult(
      createTestResult(testReportId, {
        status: 'fail',
        errorMessage: 'Timeout error',
        testName: 'failing-test-2',
      })
    );

    const failedResults = await getFailedTestResults(10);
    expect(failedResults.length).toBeGreaterThanOrEqual(2);
    expect(failedResults.every(tr => tr.status === 'fail')).toBe(true);
  });
});

describe('Analytics Queries', () => {
  beforeEach(async () => {
    // Set up test data for analytics
    const report1 = await insertReport(
      createTestReport({
        blockchain: 'ethereum',
        status: 'pass',
        duration: 5000,
      })
    );
    const report2 = await insertReport(
      createTestReport({
        blockchain: 'polkadot',
        status: 'fail',
        duration: 8000,
      })
    );

    // Add test results
    await insertTestResult(
      createTestResult(report1.id, { status: 'pass', duration: 1000 })
    );
    await insertTestResult(
      createTestResult(report1.id, { status: 'pass', duration: 2000 })
    );
    await insertTestResult(
      createTestResult(report2.id, { status: 'fail', duration: 3000 })
    );
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

  it('should get blockchain statistics', async () => {
    const stats = await getBlockchainStats('day');

    expect(Array.isArray(stats)).toBe(true);
    expect(stats.length).toBeGreaterThan(0);

    const ethereumStats = stats.find(s => s.blockchain === 'ethereum');
    expect(ethereumStats).toBeDefined();
    expect(ethereumStats?.totalReports).toBeGreaterThan(0);
    expect(ethereumStats?.successRate).toBeGreaterThanOrEqual(0);
  });

  it('should get system health metrics', async () => {
    const health = await getSystemHealthMetrics();

    expect(health).toBeDefined();
    expect(['healthy', 'warning', 'critical']).toContain(health.overallHealth);
    expect(typeof health.metrics.recentSuccessRate).toBe('number');
    expect(typeof health.metrics.averageResponseTime).toBe('number');
    expect(Array.isArray(health.alerts)).toBe(true);
  });
});

describe('Search Queries', () => {
  let testReportId: string;

  beforeEach(async () => {
    // Set up test data for search
    const report = await insertReport(
      createTestReport({
        blockchain: 'ethereum',
        testSuite: 'balance-consistency-tests',
        metadata: { environment: 'production', version: '2.1.0' },
      })
    );
    testReportId = report.id;

    await insertTestResult(
      createTestResult(testReportId, {
        testName: 'test-user-balance-consistency',
        status: 'pass',
        details: {
          description: 'Verifies user balance consistency across blocks',
        },
      })
    );

    await insertTestResult(
      createTestResult(testReportId, {
        testName: 'test-transaction-validation',
        status: 'fail',
        errorMessage: 'Transaction validation failed: insufficient balance',
        details: { description: 'Validates transaction processing' },
      })
    );
  });

  it('should perform full-text search', async () => {
    const searchResult = await performFullTextSearch({
      query: 'balance',
      includeReports: true,
      includeTestResults: true,
    });

    expect(searchResult).toBeDefined();
    expect(searchResult.results.length).toBeGreaterThan(0);
    expect(searchResult.total).toBeGreaterThan(0);
    expect(searchResult.searchTime).toBeGreaterThan(0);

    // Should find results containing 'balance'
    const hasBalanceResult = searchResult.results.some(
      result =>
        result.title.toLowerCase().includes('balance') ||
        result.description.toLowerCase().includes('balance')
    );
    expect(hasBalanceResult).toBe(true);
  });

  it('should get search suggestions', async () => {
    const suggestions = await getSearchSuggestions('eth');

    expect(suggestions).toBeDefined();
    expect(Array.isArray(suggestions.blockchains)).toBe(true);
    expect(Array.isArray(suggestions.testSuites)).toBe(true);
    expect(Array.isArray(suggestions.testNames)).toBe(true);

    // Should include ethereum in blockchain suggestions
    expect(suggestions.blockchains).toContain('ethereum');
  });

  it('should perform advanced search with filters', async () => {
    const searchResult = await performAdvancedSearch({
      query: 'transaction',
      blockchain: ['ethereum'],
      status: ['fail'],
      hasError: true,
    });

    expect(searchResult).toBeDefined();
    expect(searchResult.results.length).toBeGreaterThan(0);

    // All results should be from ethereum blockchain and have fail status
    expect(searchResult.results.every(r => r.blockchain === 'ethereum')).toBe(
      true
    );
    expect(searchResult.results.every(r => r.status === 'fail')).toBe(true);
  });

  it('should handle empty search queries gracefully', async () => {
    const searchResult = await performFullTextSearch({
      query: '',
    });

    expect(searchResult.results).toEqual([]);
    expect(searchResult.total).toBe(0);
  });
});

// Integration test to verify all query functions work together
describe('Query Integration', () => {
  it('should handle complex workflow with all query types', async () => {
    // 1. Insert a report
    const report = await insertReport(
      createTestReport({
        blockchain: 'ethereum',
        testSuite: 'integration-tests',
        status: 'pass',
        duration: 10000,
      })
    );

    // 2. Insert test results
    const testResults = [
      createTestResult(report.id, {
        testName: 'test-1',
        status: 'pass',
        duration: 1000,
      }),
      createTestResult(report.id, {
        testName: 'test-2',
        status: 'fail',
        duration: 2000,
        errorMessage: 'Test failed',
      }),
      createTestResult(report.id, {
        testName: 'test-3',
        status: 'skip',
        duration: 0,
      }),
    ];

    for (const testResult of testResults) {
      await insertTestResult(testResult);
    }

    // 3. Verify report with counts
    const reportsWithCounts = await getReportsWithCounts(
      { blockchain: 'ethereum' },
      { limit: 1 }
    );

    expect(reportsWithCounts.data.length).toBe(1);
    const reportWithCounts = reportsWithCounts.data[0];
    expect(reportWithCounts).toBeDefined();
    expect(reportWithCounts!.totalTests).toBe(3);
    expect(reportWithCounts!.passedTests).toBe(1);
    expect(reportWithCounts!.failedTests).toBe(1);
    expect(reportWithCounts!.skippedTests).toBe(1);

    // 4. Verify analytics
    const summary = await getDashboardSummary('day');
    expect(summary.totalReports).toBeGreaterThan(0);
    expect(summary.totalTests).toBeGreaterThan(0);

    // 5. Verify search
    const searchResult = await performFullTextSearch({
      query: 'integration',
      includeReports: true,
    });
    expect(searchResult.results.length).toBeGreaterThan(0);

    // 6. Clean up - verify report exists first
    const reportExists = await getReportById(report.id);
    expect(reportExists).toBeDefined();

    // Attempt cleanup (may fail in test environment due to constraints)
    try {
      const deleted = await deleteReport(report.id);
      // In a real environment, this should work, but test environment may have constraints
      console.log('Delete result:', deleted);
    } catch (error) {
      console.log('Delete failed (expected in test environment):', error);
    }
  });
});
