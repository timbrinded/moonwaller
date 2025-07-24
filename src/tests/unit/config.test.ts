import { describe, it, expect, beforeEach } from 'bun:test';

describe('Database Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  it('should use development database URL by default', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DATABASE_URL;

    // Re-import config to get fresh instance
    delete require.cache[require.resolve('../../shared/config')];
    const { config } = await import('../../shared/config');

    expect(config.database.url).toBe(
      'postgresql://dev_user:dev_password@localhost:5432/blockchain_monitoring_dev'
    );
    expect(config.env).toBe('development');
  });

  it('should use test database URL in test environment', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.TEST_DATABASE_URL;

    // Re-import config to get fresh instance
    delete require.cache[require.resolve('../../shared/config')];
    const { config } = await import('../../shared/config');

    expect(config.database.url).toBe(
      'postgresql://test_user:test_password@localhost:5433/blockchain_monitoring_test'
    );
    expect(config.env).toBe('test');
  });

  it('should prefer Neon URL in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEON_DATABASE_URL =
      'postgresql://neon-user:pass@neon.tech:5432/prod';
    process.env.DATABASE_URL = 'postgresql://regular:pass@localhost:5432/prod';
    process.env.JWT_SECRET = 'production-jwt-secret';
    process.env.API_KEY = 'production-api-key';

    // Re-import config to get fresh instance
    delete require.cache[require.resolve('../../shared/config')];
    const { config } = await import('../../shared/config');

    expect(config.database.url).toBe(
      'postgresql://neon-user:pass@neon.tech:5432/prod'
    );
    expect(config.database.ssl).toBe(true);
  });

  it('should fallback to Supabase URL if Neon not available', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEON_DATABASE_URL;
    process.env.SUPABASE_DATABASE_URL =
      'postgresql://supabase:pass@supabase.co:5432/prod';
    process.env.DATABASE_URL = 'postgresql://regular:pass@localhost:5432/prod';
    process.env.JWT_SECRET = 'production-jwt-secret';
    process.env.API_KEY = 'production-api-key';

    // Re-import config to get fresh instance
    delete require.cache[require.resolve('../../shared/config')];
    const { config } = await import('../../shared/config');

    expect(config.database.url).toBe(
      'postgresql://supabase:pass@supabase.co:5432/prod'
    );
  });

  it('should use custom environment variables when provided', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL =
      'postgresql://custom:pass@custom.host:5432/custom_db';

    // Re-import config to get fresh instance
    delete require.cache[require.resolve('../../shared/config')];
    const { config } = await import('../../shared/config');

    expect(config.database.url).toBe(
      'postgresql://custom:pass@custom.host:5432/custom_db'
    );
  });
});
