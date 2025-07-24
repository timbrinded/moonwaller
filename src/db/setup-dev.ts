#!/usr/bin/env bun

/**
 * Development environment database setup script
 */

import { setupEnvironment } from './environments';

async function setupDevelopmentEnvironment() {
  try {
    await setupEnvironment('development');
  } catch (error) {
    console.error('❌ Development environment setup failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure development database is running: docker-compose up -d postgres');
    }
    
    process.exit(1);
  }
}

if (import.meta.main) {
  setupDevelopmentEnvironment();
}

export { setupDevelopmentEnvironment };