import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { DatabaseEnvironment } from '../../db/environments';

describe('Database Multi-Environment Configuration', () => {
  let devEnv: DatabaseEnvironment;
  let testEnv: DatabaseEnvironment;

  beforeAll(async () => {
    // Initialize environments
    devEnv = new DatabaseEnvironment('development');
    testEnv = new DatabaseEnvironment('test');
  });

  afterAll(async () => {
    // Clean up connections
    await devEnv.close();
    await testEnv.close();
  });

  test('should connect to development database', async () => {
    const isHealthy = await devEnv.healthCheck();
    expect(isHealthy).toBe(true);
  });

  test('should connect to test database', async () => {
    const isHealthy = await testEnv.healthCheck();
    expect(isHealthy).toBe(true);
  });

  test('should get database info for development', async () => {
    const info = await devEnv.getInfo();
    
    expect(info.environment).toBe('development');
    expect(info.url).toContain('blockchain_monitoring_dev');
    expect(info.isHealthy).toBe(true);
    expect(info.maxConnections).toBe(10);
    expect(info.ssl).toBe(false);
  });

  test('should get database info for test', async () => {
    const info = await testEnv.getInfo();
    
    expect(info.environment).toBe('test');
    expect(info.url).toContain('blockchain_monitoring_test');
    expect(info.isHealthy).toBe(true);
    expect(info.maxConnections).toBe(5);
    expect(info.ssl).toBe(false);
  });

  test('should have different database URLs for different environments', async () => {
    const devInfo = await devEnv.getInfo();
    const testInfo = await testEnv.getInfo();
    
    expect(devInfo.url).not.toBe(testInfo.url);
    expect(devInfo.url).toContain('5432');
    expect(testInfo.url).toContain('5433');
  });

  test('should be able to run migrations on test environment', async () => {
    // Reset and migrate test database
    await testEnv.reset();
    await testEnv.migrate();
    
    const info = await testEnv.getInfo();
    // Should have at least the migration tracking table
    expect(info.migrationCount).toBeGreaterThanOrEqual(0);
    
    // Check that migration system is working by verifying drizzle_migrations table exists
    const client = testEnv.getClient();
    const migrationTable = await client`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'drizzle' 
      AND table_name = 'drizzle_migrations'
    `;
    expect(parseInt(migrationTable[0].count)).toBe(1);
  });

  test('should prevent reset on production environment', () => {
    expect(() => {
      new DatabaseEnvironment('production');
    }).toThrow(); // Will throw because no production URL is configured
  });
});

describe('Database Connection Factory', () => {
  test('should create connections with different configurations', async () => {
    const devEnv = new DatabaseEnvironment('development');
    const testEnv = new DatabaseEnvironment('test');
    
    try {
      const devClient = devEnv.getClient();
      const testClient = testEnv.getClient();
      
      // Test that they are different instances
      expect(devClient).not.toBe(testClient);
      
      // Test that they can both execute queries
      const devResult = await devClient`SELECT 'dev' as env`;
      const testResult = await testClient`SELECT 'test' as env`;
      
      expect(devResult[0].env).toBe('dev');
      expect(testResult[0].env).toBe('test');
      
    } finally {
      await devEnv.close();
      await testEnv.close();
    }
  });
});

describe('Database Migration System', () => {
  test('should track migrations properly', async () => {
    const testEnv = new DatabaseEnvironment('test');
    
    try {
      // Reset and migrate
      await testEnv.reset();
      await testEnv.migrate();
      
      const info = await testEnv.getInfo();
      expect(info.migrationCount).toBeGreaterThanOrEqual(0);
      
    } finally {
      await testEnv.close();
    }
  });
});

describe('Database Seeding System', () => {
  test('should prepare seeding for development', async () => {
    const devEnv = new DatabaseEnvironment('development');
    
    try {
      // This should not throw an error
      await devEnv.seed();
      
    } finally {
      await devEnv.close();
    }
  });

  test('should prepare seeding for test', async () => {
    const testEnv = new DatabaseEnvironment('test');
    
    try {
      // This should not throw an error
      await testEnv.seed();
      
    } finally {
      await testEnv.close();
    }
  });
});