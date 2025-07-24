#!/usr/bin/env bun

/**
 * Database setup script for all environments
 * This script handles the complete setup of database environments
 */

import { config } from '../shared/config';
import {
  getDatabaseInfo,
  testDatabaseConnection,
  environmentOps,
} from './utils';

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface SetupOptions {
  environment?: string;
  reset?: boolean;
  seed?: boolean;
  skipMigrations?: boolean;
  force?: boolean;
}

async function displayDatabaseInfo() {
  console.log('📊 Current Database Information:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const info = await getDatabaseInfo();
    console.log(`Environment: ${info.environment}`);
    console.log(`Database URL: ${info.url}`);
    console.log(
      `Health Status: ${info.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`
    );
    console.log(`Tables: ${info.tableCount}`);
    console.log(`Migrations: ${info.migrationCount}`);
    console.log(`Max Connections: ${info.connectionConfig.maxConnections}`);
    console.log(`SSL Enabled: ${info.connectionConfig.ssl}`);
    console.log(`Idle Timeout: ${info.connectionConfig.idleTimeout}s`);
    console.log(`Max Lifetime: ${info.connectionConfig.maxLifetime}s`);
  } catch (error) {
    console.error(
      '❌ Could not fetch database information:',
      getErrorMessage(error)
    );
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function setupEnvironment(options: SetupOptions = {}) {
  // Set the environment if specified
  const originalEnv = process.env.NODE_ENV;
  if (options.environment) {
    process.env.NODE_ENV = options.environment;
  }

  const env = options.environment || config.env;

  console.log(`🚀 Setting up database for ${env} environment...`);
  console.log(`🔧 Options: ${JSON.stringify(options, null, 2)}\n`);

  try {
    // Re-import config to get fresh environment-specific configuration
    delete require.cache[require.resolve('../shared/config')];
    const { config: envConfig } = await import('../shared/config');

    console.log(
      `📍 Target Database URL: ${envConfig.database.url.replace(/:[^:@]*@/, ':***@')}`
    );

    // Display current database info
    await displayDatabaseInfo();

    // Test database connection
    console.log('🔍 Testing database connection...');
    const isConnected = await testDatabaseConnection(3);
    if (!isConnected) {
      console.error('❌ Could not connect to database');
      console.error('💡 Make sure the database is running:');

      if (env === 'development') {
        console.error('   docker-compose up -d postgres');
      } else if (env === 'test') {
        console.error('   docker-compose up -d postgres-test');
      }

      process.exit(1);
    }
    console.log('✅ Database connection successful\n');

    // Environment-specific setup
    switch (env) {
      case 'development':
        if (options.reset) {
          const { resetDatabase } = await import('./reset');
          await resetDatabase(options.force);
        }
        await environmentOps.setupDevelopment();
        break;

      case 'test':
        await environmentOps.setupTest();
        break;

      case 'production':
        console.log('🏭 Production environment setup...');

        if (options.reset) {
          console.error('❌ Cannot reset production database');
          process.exit(1);
        }

        // Only run migrations in production
        const { runMigrations } = await import('./migrate');
        await runMigrations('production');

        console.log('✅ Production setup complete (migrations only)');
        break;

      default:
        console.error(`❌ Unknown environment: ${env}`);
        process.exit(1);
    }

    // Display final database info
    console.log('\n📊 Final Database State:');
    await displayDatabaseInfo();

    console.log('🎉 Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Database setup failed:', getErrorMessage(error));
    process.exit(1);
  } finally {
    // Restore original environment
    if (originalEnv) {
      process.env.NODE_ENV = originalEnv;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const options: SetupOptions = {
    environment: undefined,
    reset: args.includes('--reset') || args.includes('-r'),
    seed: args.includes('--seed') || args.includes('-s'),
    skipMigrations: args.includes('--skip-migrations'),
    force: args.includes('--force') || args.includes('-f'),
  };

  // Check for environment argument
  const envArg = args.find(arg => !arg.startsWith('-'));
  if (envArg && ['development', 'test', 'production'].includes(envArg)) {
    options.environment = envArg;
  }

  // Handle special commands
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🗄️  Database Setup Script

Usage: bun run src/db/setup.ts [environment] [options]

Environments:
  development    Setup development database (default)
  test          Setup test database
  production    Setup production database (migrations only)

Options:
  --reset, -r       Reset database before setup
  --seed, -s        Seed database with sample data
  --skip-migrations Skip running migrations
  --force, -f       Force operations without confirmation
  --help, -h        Show this help message

Examples:
  bun run src/db/setup.ts                    # Setup current environment
  bun run src/db/setup.ts development --reset # Reset and setup development
  bun run src/db/setup.ts test               # Setup test environment
  bun run src/db/setup.ts production         # Setup production (migrations only)
`);
    process.exit(0);
  }

  if (args.includes('--info') || args.includes('-i')) {
    await displayDatabaseInfo();
    process.exit(0);
  }

  // Run setup
  await setupEnvironment(options);
}

// Handle script execution
if (import.meta.main) {
  main().catch(console.error);
}

export { setupEnvironment, displayDatabaseInfo };
