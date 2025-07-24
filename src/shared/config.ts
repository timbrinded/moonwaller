export interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  ssl?: boolean;
}

export interface ServerConfig {
  port: number;
  wsPort: number;
  host: string;
}

export interface RedisConfig {
  url: string;
  enabled: boolean;
}

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  database: DatabaseConfig;
  server: ServerConfig;
  redis: RedisConfig;
  jwt: {
    secret: string;
  };
  api: {
    key: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
}

function getOptionalEnvVar(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config: AppConfig = {
  env: (process.env.NODE_ENV as AppConfig['env']) || 'development',

  database: {
    url:
      process.env.NODE_ENV === 'test'
        ? getEnvVar(
            'TEST_DATABASE_URL',
            'postgresql://test_user:test_password@localhost:5433/blockchain_monitoring_test'
          )
        : getEnvVar(
            'DATABASE_URL',
            'postgresql://dev_user:dev_password@localhost:5432/blockchain_monitoring_dev'
          ),
    maxConnections: parseInt(getOptionalEnvVar('DB_MAX_CONNECTIONS', '10')),
    ssl: process.env.NODE_ENV === 'production',
  },

  server: {
    port: parseInt(getOptionalEnvVar('PORT', '3000')),
    wsPort: parseInt(getOptionalEnvVar('WS_PORT', '3001')),
    host: getOptionalEnvVar('HOST', '0.0.0.0'),
  },

  redis: {
    url: getOptionalEnvVar('REDIS_URL', 'redis://localhost:6379'),
    enabled: getOptionalEnvVar('REDIS_ENABLED', 'true') === 'true',
  },

  jwt: {
    secret: getEnvVar('JWT_SECRET', 'dev-jwt-secret-change-in-production'),
  },

  api: {
    key: getEnvVar('API_KEY', 'dev-api-key-change-in-production'),
  },

  logging: {
    level: getOptionalEnvVar(
      'LOG_LEVEL',
      'info'
    ) as AppConfig['logging']['level'],
  },
};

// Validate configuration
if (config.env === 'production') {
  if (config.jwt.secret === 'dev-jwt-secret-change-in-production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  if (config.api.key === 'dev-api-key-change-in-production') {
    throw new Error('API_KEY must be set in production');
  }
}
