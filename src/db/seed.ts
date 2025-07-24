import { db, client, checkDatabaseHealth } from './connection';
import { config } from '../shared/config';

// Seed data generators (will be expanded in task 2.2 with actual schema)
export const seedData = {
  development: {
    // Development seed data - realistic but not too much
    reports: 50,
    testResults: 200,
    blockchains: ['ethereum', 'polkadot', 'moonbeam', 'moonriver'],
  },
  test: {
    // Test seed data - minimal but comprehensive
    reports: 10,
    testResults: 40,
    blockchains: ['ethereum', 'polkadot'],
  },
};

export async function seedDatabase(environment?: string) {
  const env = environment || config.env;

  if (env === 'production') {
    console.error('❌ Cannot seed database in production environment');
    process.exit(1);
  }

  console.log(`🌱 Seeding database for ${env} environment...`);
  console.log(
    `📍 Database URL: ${config.database.url.replace(/:[^:@]*@/, ':***@')}`
  );

  try {
    // Check database health
    console.log('🔍 Checking database connection...');
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      console.error(
        '❌ Database health check failed. Please ensure the database is running.'
      );
      process.exit(1);
    }

    // Check if tables exist
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    if (tables.length === 0) {
      console.log('⚠️  No tables found. Running migrations first...');
      const { runMigrations } = await import('./migrate');
      await runMigrations(env);
    }

    const seedConfig = seedData[env as keyof typeof seedData];
    if (!seedConfig) {
      console.error(`❌ No seed configuration found for environment: ${env}`);
      process.exit(1);
    }

    console.log(`📊 Seed configuration for ${env}:`);
    console.log(`   - Reports: ${seedConfig.reports}`);
    console.log(`   - Test Results: ${seedConfig.testResults}`);
    console.log(`   - Blockchains: ${seedConfig.blockchains.join(', ')}`);

    // TODO: Implement actual seeding logic once schema is defined in task 2.2
    console.log(
      '📝 Seeding logic will be implemented in task 2.2 with the database schema'
    );

    // For now, just verify we can connect and create a simple test entry
    try {
      await client`SELECT 1 as test`;
      console.log('✅ Database connection verified for seeding');
    } catch (error) {
      throw new Error(
        `Database connection test failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    console.log('✅ Database seeding preparation completed successfully');
    console.log(
      '💡 Full seeding implementation will be added with schema in task 2.2'
    );
  } catch (error) {
    console.error('❌ Database seeding failed:', error);

    // Provide helpful error messages
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error(
        '💡 Hint: Make sure PostgreSQL is running. Try: docker-compose up -d postgres'
      );
    } else if (
      error instanceof Error &&
      error.message.includes('relation') &&
      error.message.includes('does not exist')
    ) {
      console.error(
        '💡 Hint: Tables do not exist. Run "bun run db:migrate" first'
      );
    }

    process.exit(1);
  } finally {
    try {
      await client.end({ timeout: 5 });
    } catch (error) {
      // Ignore connection cleanup errors
      console.warn(
        'Warning during seed cleanup:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// Clear existing seed data (for development/testing)
export async function clearSeedData() {
  if (config.env === 'production') {
    console.error('❌ Cannot clear seed data in production environment');
    process.exit(1);
  }

  console.log(`🧹 Clearing seed data for ${config.env} environment...`);

  try {
    // TODO: Implement clearing logic once schema is defined
    console.log(
      '📝 Clear seed data logic will be implemented with schema in task 2.2'
    );
    console.log('✅ Seed data clearing preparation completed');
  } catch (error) {
    console.error('❌ Clearing seed data failed:', error);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (import.meta.main) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'clear') {
    clearSeedData();
  } else {
    const environment = args[0];
    seedDatabase(environment);
  }
}
