import {
  client,
  createDatabaseConnection,
  checkDatabaseHealth,
} from './connection';
import { config } from '../shared/config';

/**
 * Database utility functions for multi-environment support
 */

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface DatabaseInfo {
  environment: string;
  url: string;
  isHealthy: boolean;
  tableCount: number;
  migrationCount: number;
  connectionConfig: {
    maxConnections: number;
    ssl: boolean;
    idleTimeout: number;
    maxLifetime: number;
  };
}

/**
 * Get comprehensive database information
 */
export async function getDatabaseInfo(): Promise<DatabaseInfo> {
  const isHealthy = await checkDatabaseHealth();

  let tableCount = 0;
  let migrationCount = 0;

  if (isHealthy) {
    const { client: infoClient } = createDatabaseConnection(
      config.database.url,
      {
        maxConnections: 1,
        prepare: false,
      }
    );

    try {
      const tables = await infoClient`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      tableCount = parseInt(tables[0]?.count || '0');

      // Check for migration table
      const migrations = await infoClient`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'drizzle_migrations'
      `;

      if (parseInt(migrations[0]?.count || '0') > 0) {
        const migrationRows = await infoClient`
          SELECT COUNT(*) as count 
          FROM drizzle_migrations
        `;
        migrationCount = parseInt(migrationRows[0]?.count || '0');
      }
    } catch (error) {
      console.warn(
        'Warning: Could not fetch database statistics:',
        getErrorMessage(error)
      );
    } finally {
      await infoClient.end({ timeout: 2 });
    }
  }

  return {
    environment: config.env,
    url: config.database.url.replace(/:[^:@]*@/, ':***@'),
    isHealthy,
    tableCount,
    migrationCount,
    connectionConfig: {
      maxConnections: config.database.maxConnections || 10,
      ssl: config.database.ssl || false,
      idleTimeout: config.database.idleTimeout || 20,
      maxLifetime: config.database.maxLifetime || 1800,
    },
  };
}

/**
 * Test database connection with retry logic
 */
export async function testDatabaseConnection(
  retries: number = 3
): Promise<boolean> {
  const maxRetries = config.database.retryAttempts || retries;
  const retryDelay = config.database.retryDelay || 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const isHealthy = await checkDatabaseHealth();
      if (isHealthy) {
        return true;
      }
    } catch (error) {
      console.warn(
        `Database connection attempt ${attempt}/${maxRetries} failed:`,
        getErrorMessage(error)
      );
    }

    if (attempt < maxRetries) {
      console.log(`Retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  return false;
}

/**
 * Wait for database to become available
 */
export async function waitForDatabase(
  timeoutMs: number = 30000
): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 1000; // Check every second

  console.log('⏳ Waiting for database to become available...');

  while (Date.now() - startTime < timeoutMs) {
    const isHealthy = await checkDatabaseHealth();
    if (isHealthy) {
      console.log('✅ Database is now available');
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  console.error('❌ Database did not become available within timeout');
  return false;
}

/**
 * Validate database schema (basic check)
 */
export async function validateDatabaseSchema(): Promise<{
  isValid: boolean;
  missingTables: string[];
  errors: string[];
}> {
  const result = {
    isValid: true,
    missingTables: [] as string[],
    errors: [] as string[],
  };

  try {
    // Check if database is healthy
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      result.isValid = false;
      result.errors.push('Database connection failed');
      return result;
    }

    // Create fresh connection for validation
    const { client: validationClient } = createDatabaseConnection(
      config.database.url,
      {
        maxConnections: 1,
        prepare: false,
      }
    );

    try {
      // Get all tables
      const tables = await validationClient`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;

      const tableNames = tables.map(t => t.table_name);

      // TODO: Add expected table validation once schema is defined in task 2.2
      // For now, just check that we have some tables if migrations have been run
      const migrationTable = tableNames.find(
        name => name === 'drizzle_migrations'
      );
      if (migrationTable) {
        const migrationCount = await validationClient`
          SELECT COUNT(*) as count FROM drizzle_migrations
        `;

        if (
          parseInt(migrationCount[0]?.count || '0') > 0 &&
          tableNames.length === 1
        ) {
          result.errors.push(
            'Migrations have been run but no application tables found'
          );
          result.isValid = false;
        }
      }
    } finally {
      await validationClient.end({ timeout: 2 });
    }
  } catch (error) {
    result.isValid = false;
    result.errors.push(
      `Schema validation error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  totalTables: number;
  totalRows: number;
  databaseSize: string;
  connectionCount: number;
}> {
  try {
    // Get table count
    const tables = await client`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    // Get approximate row count for all tables
    const rowCounts = await client`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins - n_tup_del as row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
    `;

    const totalRows = rowCounts.reduce(
      (sum, table) => sum + (parseInt(table.row_count) || 0),
      0
    );

    // Get database size
    const sizeResult = await client`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;

    // Get connection count
    const connectionResult = await client`
      SELECT count(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;

    return {
      totalTables: parseInt(tables[0]?.count || '0'),
      totalRows,
      databaseSize: sizeResult[0]?.size || 'unknown',
      connectionCount: parseInt(connectionResult[0]?.count || '0'),
    };
  } catch (error) {
    console.warn(
      'Could not fetch database statistics:',
      error instanceof Error ? error.message : String(error)
    );
    return {
      totalTables: 0,
      totalRows: 0,
      databaseSize: 'Unknown',
      connectionCount: 0,
    };
  }
}

/**
 * Environment-specific database operations
 */
export const environmentOps = {
  /**
   * Setup development environment
   */
  async setupDevelopment() {
    console.log('🔧 Setting up development environment...');

    // Wait for database
    const isAvailable = await waitForDatabase(30000);
    if (!isAvailable) {
      throw new Error('Development database is not available');
    }

    // Run migrations
    const { runMigrations } = await import('./migrate');
    await runMigrations('development');

    // Seed with development data
    const { seedDatabase } = await import('./seed');
    await seedDatabase('development');

    console.log('✅ Development environment setup complete');
  },

  /**
   * Setup test environment
   */
  async setupTest() {
    console.log('🧪 Setting up test environment...');

    // Wait for test database
    const isAvailable = await waitForDatabase(15000);
    if (!isAvailable) {
      throw new Error('Test database is not available');
    }

    // Reset and migrate
    const { resetDatabase } = await import('./reset');
    await resetDatabase(true); // Force reset for tests

    const { runMigrations } = await import('./migrate');
    await runMigrations('test');

    // Seed with minimal test data
    const { seedDatabase } = await import('./seed');
    await seedDatabase('test');

    console.log('✅ Test environment setup complete');
  },

  /**
   * Cleanup test environment
   */
  async cleanupTest() {
    if (config.env !== 'test') {
      console.warn('⚠️  Cleanup should only be run in test environment');
      return;
    }

    console.log('🧹 Cleaning up test environment...');

    const { resetDatabase } = await import('./reset');
    await resetDatabase(true);

    console.log('✅ Test environment cleanup complete');
  },
};
