/**
 * Database environment management utilities
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from './schema';

export interface EnvironmentConfig {
  name: string;
  databaseUrl: string;
  maxConnections: number;
  ssl: boolean;
}

export const environments: Record<string, EnvironmentConfig> = {
  development: {
    name: 'development',
    databaseUrl:
      process.env.DATABASE_URL ||
      'postgresql://dev_user:dev_password@localhost:5432/blockchain_monitoring_dev',
    maxConnections: 10,
    ssl: false,
  },
  test: {
    name: 'test',
    databaseUrl:
      process.env.TEST_DATABASE_URL ||
      'postgresql://test_user:test_password@localhost:5433/blockchain_monitoring_test',
    maxConnections: 5,
    ssl: false,
  },
  production: {
    name: 'production',
    databaseUrl:
      process.env.NEON_DATABASE_URL ||
      process.env.SUPABASE_DATABASE_URL ||
      process.env.DATABASE_URL ||
      '',
    maxConnections: 20,
    ssl: true,
  },
};

export class DatabaseEnvironment {
  private client: postgres.Sql;
  private db: ReturnType<typeof drizzle>;
  private config: EnvironmentConfig;

  constructor(environmentName: string) {
    const config = environments[environmentName];
    if (!config) {
      throw new Error(`Unknown environment: ${environmentName}`);
    }
    this.config = config;

    if (!this.config.databaseUrl) {
      throw new Error(
        `Database URL not configured for environment: ${environmentName}`
      );
    }

    this.client = postgres(this.config.databaseUrl, {
      max: this.config.maxConnections,
      ssl: this.config.ssl ? 'require' : false,
      idle_timeout: 20,
      max_lifetime: 1800,
      connect_timeout: 30,
      transform: { undefined: null },
      prepare: environmentName !== 'test',
    });

    this.db = drizzle(this.client, { schema });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client`SELECT 1 as health`;
      return result.length === 1 && result[0]?.health === 1;
    } catch (error) {
      console.error(
        `Health check failed for ${this.config.name}:`,
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  async getInfo() {
    const isHealthy = await this.healthCheck();
    let tableCount = 0;
    let migrationCount = 0;

    if (isHealthy) {
      try {
        const tables = await this.client`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `;
        tableCount = parseInt(tables[0]?.count || '0');

        const migrations = await this.client`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'drizzle_migrations'
        `;

        if (parseInt(migrations[0]?.count || '0') > 0) {
          const migrationRows = await this.client`
            SELECT COUNT(*) as count 
            FROM drizzle_migrations
          `;
          migrationCount = parseInt(migrationRows[0]?.count || '0');
        }
      } catch (error) {
        console.warn(
          'Could not fetch database statistics:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    return {
      environment: this.config.name,
      url: this.config.databaseUrl.replace(/:[^:@]*@/, ':***@'),
      isHealthy,
      tableCount,
      migrationCount,
      maxConnections: this.config.maxConnections,
      ssl: this.config.ssl,
    };
  }

  async reset(): Promise<void> {
    if (this.config.name === 'production') {
      throw new Error('Cannot reset production database');
    }

    console.log(`🔄 Resetting ${this.config.name} database...`);

    const tables = await this.client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log(`📊 Found ${tables.length} tables to drop`);

    await this.client`DROP SCHEMA IF EXISTS public CASCADE`;
    await this.client`CREATE SCHEMA public`;
    await this.client`GRANT ALL ON SCHEMA public TO public`;

    console.log('✅ Database reset completed');
  }

  async migrate(): Promise<void> {
    console.log(`📦 Running migrations for ${this.config.name}...`);

    await migrate(this.db, {
      migrationsFolder: './src/db/migrations',
      migrationsTable: 'drizzle_migrations',
    });

    const tables = await this.client`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    console.log(`✅ Migrations completed - ${tables[0]?.count || 0} tables`);
  }

  async seed(): Promise<void> {
    if (this.config.name === 'production') {
      throw new Error('Cannot seed production database');
    }

    console.log(`🌱 Seeding ${this.config.name} database...`);

    // TODO: Implement actual seeding logic in task 2.2
    console.log('📝 Seeding logic will be implemented with schema in task 2.2');
    console.log('✅ Seeding preparation completed');
  }

  async close(): Promise<void> {
    try {
      await this.client.end({ timeout: 5 });
    } catch (error) {
      console.warn(
        `Warning during ${this.config.name} database cleanup:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  getClient() {
    return this.client;
  }

  getDb() {
    return this.db;
  }
}

export async function setupEnvironment(environmentName: string): Promise<void> {
  const env = new DatabaseEnvironment(environmentName);

  try {
    console.log(`🚀 Setting up ${environmentName} environment...`);

    // Display info
    const info = await env.getInfo();
    console.log(`📍 Database URL: ${info.url}`);
    console.log(
      `🔍 Health Status: ${info.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`
    );

    if (!info.isHealthy) {
      throw new Error(`Database is not healthy. Please ensure it is running.`);
    }

    // Reset for test environment
    if (environmentName === 'test') {
      await env.reset();
    }

    // Run migrations
    await env.migrate();

    // Seed data
    await env.seed();

    console.log(`✅ ${environmentName} environment setup completed`);
  } finally {
    await env.close();
  }
}
