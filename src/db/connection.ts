import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../shared/config';
import * as schema from './schema';

// Create connection pool
const connectionString = config.database.url;

// Create postgres client with connection pooling
const client = postgres(connectionString, {
  max: config.database.maxConnections || 10,
  ssl: config.database.ssl ? 'require' : false,
  onnotice: config.env === 'development' ? console.log : undefined,
  idle_timeout: config.database.idleTimeout || 20,
  max_lifetime: config.database.maxLifetime || 1800,
  connect_timeout: config.database.connectionTimeout || 30,
  transform: {
    undefined: null, // Transform undefined to null for PostgreSQL
  },
  // Enable prepared statements for better performance
  prepare: config.env !== 'test',
});

// Create Drizzle database instance
export const db = drizzle(client, { schema });

// Export client for direct access if needed
export { client };

// Database connection factory for different environments
export function createDatabaseConnection(databaseUrl?: string, options?: {
  maxConnections?: number;
  ssl?: boolean;
  prepare?: boolean;
}) {
  const url = databaseUrl || config.database.url;
  const connectionOptions = {
    max: options?.maxConnections || config.database.maxConnections || 10,
    ssl: options?.ssl !== undefined ? options.ssl : config.database.ssl || false,
    onnotice: config.env === 'development' ? console.log : undefined,
    idle_timeout: config.database.idleTimeout || 20,
    max_lifetime: config.database.maxLifetime || 1800,
    connect_timeout: config.database.connectionTimeout || 30,
    transform: {
      undefined: null,
    },
    prepare: options?.prepare !== undefined ? options.prepare : config.env !== 'test',
  };

  const newClient = postgres(url, connectionOptions);
  return {
    client: newClient,
    db: drizzle(newClient, { schema }),
  };
}

// Graceful shutdown
export async function closeDatabase() {
  try {
    await client.end({ timeout: 5 });
  } catch (error) {
    console.warn('Warning during database shutdown:', error instanceof Error ? error.message : String(error));
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    // Create a fresh connection for health check to avoid connection state issues
    const { client: healthClient } = createDatabaseConnection(config.database.url, {
      maxConnections: 1,
      prepare: false,
    });
    
    try {
      const result = await healthClient`SELECT 1 as health`;
      const isHealthy = result.length === 1 && result[0]?.health === 1;
      return isHealthy;
    } finally {
      await healthClient.end({ timeout: 2 });
    }
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}