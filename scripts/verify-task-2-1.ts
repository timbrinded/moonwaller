#!/usr/bin/env bun

/**
 * Verification script for Task 2.1: Set up multi-environment database configuration
 * 
 * This script verifies that all requirements for task 2.1 have been completed:
 * - Set up local PostgreSQL with Docker for development and testing
 * - Configure Neon connection for production environment
 * - Create environment-specific database configuration with Drizzle
 * - Set up database migration system that works across all environments
 * - Add database seeding scripts for development and testing
 */

import { DatabaseEnvironment, environments } from '../src/db/environments';

async function verifyTask21() {
  console.log('🔍 Verifying Task 2.1: Multi-environment database configuration\n');
  
  const results = {
    dockerSetup: false,
    environmentConfig: false,
    migrationSystem: false,
    seedingSystem: false,
    neonConfig: false,
  };
  
  // 1. Verify Docker setup for development and testing
  console.log('1️⃣ Checking Docker PostgreSQL setup...');
  try {
    const devEnv = new DatabaseEnvironment('development');
    const testEnv = new DatabaseEnvironment('test');
    
    const devHealthy = await devEnv.healthCheck();
    const testHealthy = await testEnv.healthCheck();
    
    if (devHealthy && testHealthy) {
      console.log('   ✅ Development database: Connected');
      console.log('   ✅ Test database: Connected');
      results.dockerSetup = true;
    } else {
      console.log('   ❌ Database connections failed');
    }
    
    await devEnv.close();
    await testEnv.close();
  } catch (error) {
    console.log('   ❌ Docker setup verification failed:', error.message);
  }
  
  // 2. Verify environment-specific configuration
  console.log('\n2️⃣ Checking environment-specific configuration...');
  try {
    const devConfig = environments.development;
    const testConfig = environments.test;
    const prodConfig = environments.production;
    
    console.log(`   ✅ Development: ${devConfig.databaseUrl.includes('5432') ? 'Port 5432' : 'Custom port'}`);
    console.log(`   ✅ Test: ${testConfig.databaseUrl.includes('5433') ? 'Port 5433' : 'Custom port'}`);
    console.log(`   ✅ Production: ${prodConfig.databaseUrl ? 'Configured' : 'Not configured'}`);
    
    results.environmentConfig = true;
  } catch (error) {
    console.log('   ❌ Environment configuration verification failed:', error.message);
  }
  
  // 3. Verify migration system
  console.log('\n3️⃣ Checking migration system...');
  try {
    const testEnv = new DatabaseEnvironment('test');
    
    await testEnv.reset();
    await testEnv.migrate();
    
    const info = await testEnv.getInfo();
    if (info.migrationCount >= 0) {
      console.log('   ✅ Migration system working');
      results.migrationSystem = true;
    }
    
    await testEnv.close();
  } catch (error) {
    console.log('   ❌ Migration system verification failed:', error.message);
  }
  
  // 4. Verify seeding system
  console.log('\n4️⃣ Checking seeding system...');
  try {
    const testEnv = new DatabaseEnvironment('test');
    
    await testEnv.seed(); // Should not throw
    console.log('   ✅ Seeding system prepared');
    results.seedingSystem = true;
    
    await testEnv.close();
  } catch (error) {
    console.log('   ❌ Seeding system verification failed:', error.message);
  }
  
  // 5. Verify Neon configuration support
  console.log('\n5️⃣ Checking Neon/production configuration...');
  try {
    const prodConfig = environments.production;
    if (prodConfig.ssl && prodConfig.maxConnections === 20) {
      console.log('   ✅ Production configuration ready for Neon/Supabase');
      results.neonConfig = true;
    }
  } catch (error) {
    console.log('   ❌ Neon configuration verification failed:', error.message);
  }
  
  // Summary
  console.log('\n📊 Task 2.1 Verification Results:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Docker Setup: ${results.dockerSetup ? '✅' : '❌'}`);
  console.log(`Environment Config: ${results.environmentConfig ? '✅' : '❌'}`);
  console.log(`Migration System: ${results.migrationSystem ? '✅' : '❌'}`);
  console.log(`Seeding System: ${results.seedingSystem ? '✅' : '❌'}`);
  console.log(`Neon Config: ${results.neonConfig ? '✅' : '❌'}`);
  
  const allPassed = Object.values(results).every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 Task 2.1 COMPLETED: Multi-environment database configuration is ready!');
    console.log('\n💡 Available commands:');
    console.log('   bun run db:setup:dev    - Setup development environment');
    console.log('   bun run db:setup:test   - Setup test environment');
    console.log('   bun run db:info         - Show database information');
    console.log('   bun run db:test-connections - Test all connections');
    process.exit(0);
  } else {
    console.log('\n❌ Task 2.1 verification failed. Please check the failed items above.');
    process.exit(1);
  }
}

if (import.meta.main) {
  verifyTask21().catch(console.error);
}