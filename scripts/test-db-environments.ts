#!/usr/bin/env bun

/**
 * Test script to verify database connections across all environments
 */

// Import will be done dynamically to avoid connection issues

async function testEnvironment(env: string) {
  console.log(`\n🧪 Testing ${env} environment...`);
  
  // Set environment
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  
  try {
    // Import postgres directly to create a fresh connection
    const postgres = (await import('postgres')).default;
    
    // Re-import config to get fresh instance
    delete require.cache[require.resolve('../src/shared/config')];
    const { config } = await import('../src/shared/config');
    
    console.log(`   Database URL: ${config.database.url.replace(/:[^:@]*@/, ':***@')}`);
    console.log(`   SSL Enabled: ${config.database.ssl}`);
    console.log(`   Max Connections: ${config.database.maxConnections}`);
    
    // Create a fresh client for this test
    const testClient = postgres(config.database.url, {
      max: 1,
      ssl: config.database.ssl ? 'require' : false,
      idle_timeout: 5,
      max_lifetime: 10,
    });
    
    try {
      const result = await testClient`SELECT 1 as health`;
      const isHealthy = result.length === 1 && result[0].health === 1;
      console.log(`   Connection: ${isHealthy ? '✅ Success' : '❌ Failed'}`);
      return isHealthy;
    } finally {
      await testClient.end({ timeout: 2 });
    }
  } catch (error) {
    console.log(`   Connection: ❌ Error - ${error.message}`);
    return false;
  } finally {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  }
}

async function main() {
  console.log('🚀 Testing database connections across environments...');
  
  const results = {
    development: await testEnvironment('development'),
    test: await testEnvironment('test'),
  };
  
  console.log('\n📊 Results Summary:');
  console.log(`   Development: ${results.development ? '✅' : '❌'}`);
  console.log(`   Test: ${results.test ? '✅' : '❌'}`);
  
  const allPassed = Object.values(results).every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 All database environments are working correctly!');
    process.exit(0);
  } else {
    console.log('\n❌ Some database environments failed. Check Docker containers and environment variables.');
    process.exit(1);
  }
}

main().catch(console.error);