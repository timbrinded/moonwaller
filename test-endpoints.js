#!/usr/bin/env bun

// Simple script to test endpoints
const BASE_URL = 'http://localhost:3000';

async function testEndpoint(path, description) {
  try {
    console.log(`\n🧪 Testing ${description}...`);
    const response = await fetch(`${BASE_URL}${path}`);
    const contentType = response.headers.get('content-type');

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${contentType}`);

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      console.log(`   Response:`, JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log(
        `   Response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`
      );
    }

    return response.ok;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing Blockchain Monitoring Dashboard Endpoints\n');
  console.log(`Base URL: ${BASE_URL}`);

  const tests = [
    ['/', 'Homepage'],
    ['/api', 'API Index'],
    ['/api/health', 'Health Check'],
  ];

  let passed = 0;
  let total = tests.length;

  for (const [path, description] of tests) {
    const success = await testEndpoint(path, description);
    if (success) {
      console.log(`   ✅ ${description} - PASSED`);
      passed++;
    } else {
      console.log(`   ❌ ${description} - FAILED`);
    }
  }

  console.log(`\n📊 Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 All endpoints are working correctly!');
  } else {
    console.log(
      '⚠️  Some endpoints failed. Make sure the dev server is running with: bun run dev'
    );
  }
}

runTests();
