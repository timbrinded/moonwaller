// TypeScript interfaces for moonwall test reports
// These interfaces define the structure of incoming JSON reports and database entities

// Database entity types (imported from schema)
import type {
  Report,
  NewReport,
  TestResult,
  NewTestResult,
} from '../../db/schema';

// Re-export database types for convenience
export type { Report, NewReport, TestResult, NewTestResult };

// Moonwall test report structure (incoming JSON)
export interface MoonwallTestReport {
  id: string;
  timestamp: Date;
  blockchain: string;
  testSuite: string;
  results: MoonwallTestResult[];
  metadata: {
    version: string;
    environment: string;
    duration: number;
    [key: string]: any; // Allow additional metadata fields
  };
}

export interface MoonwallTestResult {
  testName: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  details?: any;
}

// API response types
export interface ReportWithResults extends Report {
  results: TestResult[];
}

// Query parameter types for API endpoints
export interface ReportQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'timestamp' | 'status' | 'duration' | 'blockchain' | 'testSuite';
  sortOrder?: 'asc' | 'desc';
  blockchain?: string;
  status?: 'pass' | 'fail' | 'skip' | 'running' | 'pending';
  testSuite?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// WebSocket event types for real-time updates
export interface WebSocketEvents {
  'new-report': Report;
  'test-status-update': {
    reportId: string;
    status: string;
    timestamp: Date;
  };
  'system-health': {
    activeTests: number;
    failureRate: number;
    lastUpdate: Date;
  };
}

// Validation and transformation types
export interface ReportValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ReportTransformResult {
  report: NewReport;
  testResults: NewTestResult[];
}
