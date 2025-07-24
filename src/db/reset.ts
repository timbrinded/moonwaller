import { client, checkDatabaseHealth } from './connection';
import { config } from '../shared/config';

export async function resetDatabase(force: boolean = false) {
  if (config.env === 'production') {
    console.error('❌ Cannot reset database in production environment');
    process.exit(1);
  }

  console.log(`🔄 Resetting database for ${config.env} environment...`);
  console.log(`📍 Database URL: ${config.database.url.replace(/:[^:@]*@/, ':***@')}`);

  if (!force && config.env !== 'test') {
    console.log('⚠️  This will permanently delete all data in the database.');
    console.log('💡 Use --force flag or set NODE_ENV=test to skip this warning');
    
    // In a real scenario, you might want to add a confirmation prompt
    // For now, we'll just proceed with a warning
    console.log('⏳ Proceeding in 3 seconds... (Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  try {
    // Check if database is accessible
    console.log('🔍 Checking database connection...');
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      console.error('❌ Cannot connect to database. Please ensure it is running.');
      process.exit(1);
    }

    console.log('🗑️  Dropping all tables and schemas...');
    
    // Get list of tables before dropping
    const tablesBefore = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log(`📊 Found ${tablesBefore.length} tables to drop`);

    // Drop all tables and recreate schema
    await client`DROP SCHEMA IF EXISTS public CASCADE`;
    await client`CREATE SCHEMA public`;
    await client`GRANT ALL ON SCHEMA public TO public`;
    
    // Grant permissions to the current user (handle different user names)
    const currentUser = client.options.user || client.options.username || 'postgres';
    try {
      await client.unsafe(`GRANT ALL ON SCHEMA public TO ${currentUser}`);
    } catch (error) {
      // If grant fails, it's not critical for development/test
      console.warn(`Warning: Could not grant permissions to user ${currentUser}:`, error.message);
    }
    
    // Verify reset
    const tablesAfter = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log('✅ Database reset completed successfully');
    console.log(`📊 Tables remaining: ${tablesAfter.length}`);
    console.log('💡 Run "bun run db:migrate" to recreate tables');
    console.log('💡 Run "bun run db:seed" to populate with sample data');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    
    // Provide helpful error messages
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Hint: Make sure PostgreSQL is running. Try: docker-compose up -d postgres');
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run reset if this file is executed directly
if (import.meta.main) {
  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f');
  resetDatabase(force);
}