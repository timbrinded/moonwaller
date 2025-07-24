#!/usr/bin/env bun

/**
 * Test environment database setup script
 */

import { setupEnvironment } from './environments';

async function setupTestEnvironment() {
  try {
    await setupEnvironment('test');
  } catch (error) {
    console.error('❌ Test environment setup failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure test database is running: docker-compose up -d postgres-test');
    }
    
    process.exit(1);
  }
}

if (import.meta.main) {
  setupTestEnvironment();
}

export { setupTestEnvironment };