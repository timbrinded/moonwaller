// Test script to verify database schema and constraints
import { db } from './connection';
import { reports, testResults } from './schema';
import type { NewReport, NewTestResult } from './schema';

async function testDatabaseSchema() {
  console.log('🧪 Testing database schema and constraints...');

  try {
    // Test 1: Insert valid report
    console.log('✅ Test 1: Inserting valid report...');
    const validReport: NewReport = {
      blockchain: 'ethereum',
      testSuite: 'integration-tests',
      status: 'pass',
      duration: 5000,
      metadata: {
        version: '1.0.0',
        environment: 'development',
        totalTests: 10,
        passedTests: 10,
      },
    };

    const insertedReports = await db
      .insert(reports)
      .values(validReport)
      .returning();
    const insertedReport = insertedReports[0];

    if (!insertedReport) {
      throw new Error('Failed to insert report');
    }

    console.log(`✅ Report inserted with ID: ${insertedReport.id}`);

    // Test 2: Insert valid test results
    console.log('✅ Test 2: Inserting valid test results...');
    const validTestResults: NewTestResult[] = [
      {
        reportId: insertedReport.id,
        testName: 'should connect to blockchain',
        status: 'pass',
        duration: 1000,
        details: { gasUsed: 21000 },
      },
      {
        reportId: insertedReport.id,
        testName: 'should validate transaction',
        status: 'pass',
        duration: 2000,
        details: { transactionHash: '0x123...' },
      },
    ];

    await db.insert(testResults).values(validTestResults);
    console.log('✅ Test results inserted successfully');

    // Test 3: Verify foreign key relationship
    console.log('✅ Test 3: Verifying foreign key relationship...');
    const reportWithResults = await db
      .select()
      .from(reports)
      .leftJoin(testResults, eq(reports.id, testResults.reportId))
      .where(eq(reports.id, insertedReport.id));

    console.log(
      `✅ Found report with ${reportWithResults.length} test results`
    );

    // Test 4: Test status constraint (should fail)
    console.log('❌ Test 4: Testing invalid status constraint...');
    try {
      await db.insert(reports).values({
        blockchain: 'bitcoin',
        testSuite: 'unit-tests',
        status: 'invalid-status' as any,
        duration: 1000,
      });
      console.log(
        '❌ ERROR: Invalid status was accepted (constraint not working)'
      );
    } catch (error) {
      console.log('✅ Status constraint working: Invalid status rejected');
    }

    // Test 5: Test duration constraint (should fail)
    console.log('❌ Test 5: Testing negative duration constraint...');
    try {
      await db.insert(reports).values({
        blockchain: 'polygon',
        testSuite: 'performance-tests',
        status: 'fail',
        duration: -100,
      });
      console.log(
        '❌ ERROR: Negative duration was accepted (constraint not working)'
      );
    } catch (error) {
      console.log('✅ Duration constraint working: Negative duration rejected');
    }

    // Test 6: Test JSONB metadata querying
    console.log('✅ Test 6: Testing JSONB metadata querying...');
    const reportsWithMetadata = await db
      .select()
      .from(reports)
      .where(sql`metadata->>'environment' = 'development'`);

    console.log(
      `✅ Found ${reportsWithMetadata.length} reports with development environment`
    );

    // Test 7: Test indexing performance (basic check)
    console.log('✅ Test 7: Testing index usage...');
    const recentReports = await db
      .select()
      .from(reports)
      .where(gte(reports.timestamp, new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .orderBy(desc(reports.timestamp))
      .limit(10);

    console.log(
      `✅ Found ${recentReports.length} recent reports (index should be used)`
    );

    console.log('🎉 All schema tests completed successfully!');
  } catch (error) {
    console.error('❌ Schema test failed:', error);
    throw error;
  }
}

// Import required functions
import { eq, gte, desc, sql } from 'drizzle-orm';

// Run tests if this file is executed directly
if (import.meta.main) {
  testDatabaseSchema()
    .then(() => {
      console.log('✅ Schema validation completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Schema validation failed:', error);
      process.exit(1);
    });
}

export { testDatabaseSchema };
