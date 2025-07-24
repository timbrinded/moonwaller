import { migrate } from 'drizzle-orm/postgres-js/migrator';
import {
  db,
  client,
  createDatabaseConnection,
  checkDatabaseHealth,
} from './connection';
import { config } from '../shared/config';

export async function runMigrations(targetEnvironment?: string) {
  const env = targetEnvironment || config.env;
  console.log(`🚀 Running migrations for ${env} environment...`);
  console.log(
    `📍 Database URL: ${config.database.url.replace(/:[^:@]*@/, ':***@')}`
  );

  // Check database health before migration
  console.log('🔍 Checking database connection...');
  const isHealthy = await checkDatabaseHealth();
  if (!isHealthy) {
    console.error(
      '❌ Database health check failed. Please ensure the database is running.'
    );
    process.exit(1);
  }
  console.log('✅ Database connection verified');

  try {
    console.log('📦 Applying migrations...');
    await migrate(db, {
      migrationsFolder: './src/db/migrations',
      migrationsTable: 'drizzle_migrations',
    });
    console.log('✅ Migrations completed successfully');

    // Verify migration success
    const migrationCheck = await client`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log(
      `📊 Database now contains ${migrationCheck[0]?.count || 0} tables`
    );
  } catch (error) {
    console.error('❌ Migration failed:', error);

    // Provide helpful error messages
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error(
        '💡 Hint: Make sure PostgreSQL is running. Try: docker-compose up -d postgres'
      );
    } else if (
      error instanceof Error &&
      error.message.includes('database') &&
      error.message.includes('does not exist')
    ) {
      console.error(
        '💡 Hint: Database does not exist. Check your DATABASE_URL and ensure the database is created.'
      );
    }

    process.exit(1);
  } finally {
    try {
      await client.end({ timeout: 5 });
    } catch (error) {
      // Ignore connection cleanup errors
      console.warn(
        'Warning during migration cleanup:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// Rollback migrations (for development/testing)
export async function rollbackMigrations(steps: number = 1) {
  if (config.env === 'production') {
    console.error('❌ Cannot rollback migrations in production environment');
    process.exit(1);
  }

  console.log(
    `🔄 Rolling back ${steps} migration(s) for ${config.env} environment...`
  );

  try {
    // Note: Drizzle doesn't have built-in rollback, so we'd need to implement this manually
    // For now, we'll just log that this feature needs to be implemented
    console.log('⚠️  Rollback functionality not yet implemented');
    console.log(
      '💡 For now, use "bun run db:reset" followed by "bun run db:migrate"'
    );
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (import.meta.main) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'rollback') {
    const steps = parseInt(args[1] || '1');
    rollbackMigrations(steps);
  } else {
    runMigrations();
  }
}
