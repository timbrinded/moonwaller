# Database Documentation - Moonwaller

## Overview

Moonwaller uses PostgreSQL as its database with Drizzle ORM for type-safe database operations. The project supports three distinct environments (development, test, production) with comprehensive scripts for database management.

## Technology Stack

- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM with postgres.js driver
- **Local Development**: Docker Compose
- **Production**: Cloud databases (Neon, Supabase)
- **Migration Tool**: Drizzle Kit

## Database Environments

### Development Environment

- **Port**: 5432
- **Database**: `blockchain_monitoring_dev`
- **User**: `dev_user`
- **Password**: `dev_password`
- **SSL**: Disabled
- **Container**: `blockchain-monitor-db`

### Test Environment

- **Port**: 5433
- **Database**: `blockchain_monitoring_test`
- **User**: `test_user`
- **Password**: `test_password`
- **SSL**: Disabled
- **Container**: `blockchain-monitor-test-db`

### Production Environment

- **Port**: Standard PostgreSQL port
- **Database**: Configured via environment variables
- **SSL**: Required
- **Providers**: Neon (preferred), Supabase (fallback)
- **Environment Variables**:
  - `NEON_DATABASE_URL` (primary)
  - `SUPABASE_DATABASE_URL` (secondary)
  - `DATABASE_URL` (fallback)

## Database Scripts

### Core Scripts

| Script        | Command                     | Purpose                                      |
| ------------- | --------------------------- | -------------------------------------------- |
| `db:generate` | `drizzle-kit generate`      | Generate migration files from schema changes |
| `db:migrate`  | `bun run src/db/migrate.ts` | Apply pending migrations to database         |
| `db:seed`     | `bun run src/db/seed.ts`    | Populate database with test data             |
| `db:reset`    | `bun run src/db/reset.ts`   | Drop all tables and recreate schema          |
| `db:studio`   | `drizzle-kit studio`        | Open Drizzle Studio for database exploration |

### Setup Scripts

| Script           | Command                           | Purpose                                  |
| ---------------- | --------------------------------- | ---------------------------------------- |
| `db:setup`       | `bun run src/db/setup.ts`         | Complete database setup (migrate + seed) |
| `db:setup:dev`   | `bun run src/db/setup-dev.ts`     | Setup development environment            |
| `db:setup:test`  | `bun run src/db/setup-test.ts`    | Setup test environment                   |
| `db:setup:reset` | `bun run src/db/setup.ts --reset` | Reset and setup database                 |
| `db:info`        | `bun run src/db/setup.ts --info`  | Display database connection info         |

### Docker Scripts

| Script        | Command                                             | Purpose                                     |
| ------------- | --------------------------------------------------- | ------------------------------------------- |
| `docker:up`   | `docker-compose up -d`                              | Start all containers (dev database + redis) |
| `docker:down` | `docker-compose down`                               | Stop all containers                         |
| `docker:logs` | `docker-compose logs -f`                            | View container logs                         |
| `docker:test` | `docker-compose --profile test up -d postgres-test` | Start test database only                    |

### Utility Scripts

| Script                | Command                                   | Purpose                              |
| --------------------- | ----------------------------------------- | ------------------------------------ |
| `db:test-connections` | `bun run scripts/test-db-environments.ts` | Test connections to all environments |

## Common Scenarios

### 1. Testing After Code Changes

To ensure your database-related changes haven't broken anything:

```bash
# 1. Run unit tests
bun test

# 2. Start test database
bun run docker:test

# 3. Setup test environment
bun run db:setup:test

# 4. Run integration tests
bun run test:integration

# 5. Test all database connections
bun run db:test-connections
```

### 2. Local Development Setup

For manual end-to-end testing locally:

```bash
# 1. Start development database and Redis
bun run docker:up

# 2. Setup development database (migrate + seed)
bun run db:setup:dev

# 3. Start the development server
bun run dev

# 4. Access the application at http://localhost:3000
```

If you need to reset your local database:

```bash
# Reset and re-setup
bun run db:setup:reset
```

### 3. Connecting to Remote Database

To connect to a remote database for testing or debugging:

```bash
# 1. Set the appropriate environment variable
export NEON_DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
# or
export SUPABASE_DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# 2. Set environment to production
export NODE_ENV=production

# 3. Check connection
bun run db:info

# 4. Run migrations if needed
bun run db:migrate

# 5. Start the application
bun run start
```

### 4. Production Deployment

For real production deployment:

```bash
# 1. Ensure all required environment variables are set
# - NEON_DATABASE_URL or SUPABASE_DATABASE_URL
# - JWT_SECRET (must not be default)
# - API_KEY (must not be default)
# - NODE_ENV=production

# 2. Run database migrations
bun run db:migrate

# 3. Build the application
bun run build

# 4. Start the production server
bun run start
```

## Database Configuration

### Connection Settings

The database configuration is managed through `src/shared/config.ts` with the following defaults:

- **Max Connections**: 10 (configurable via `DB_MAX_CONNECTIONS`)
- **Connection Timeout**: 30 seconds (configurable via `DB_CONNECTION_TIMEOUT`)
- **Idle Timeout**: 20 seconds (configurable via `DB_IDLE_TIMEOUT`)
- **Max Lifetime**: 1800 seconds / 30 minutes (configurable via `DB_MAX_LIFETIME`)
- **Retry Attempts**: 3 (configurable via `DB_RETRY_ATTEMPTS`)
- **Retry Delay**: 1000ms (configurable via `DB_RETRY_DELAY`)

### Environment Variables

| Variable                | Description                      | Default                                                                          |
| ----------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Development database URL         | `postgresql://dev_user:dev_password@localhost:5432/blockchain_monitoring_dev`    |
| `TEST_DATABASE_URL`     | Test database URL                | `postgresql://test_user:test_password@localhost:5433/blockchain_monitoring_test` |
| `NEON_DATABASE_URL`     | Production Neon database URL     | None (required in production)                                                    |
| `SUPABASE_DATABASE_URL` | Production Supabase database URL | None (fallback option)                                                           |

## Database Health Checks

The system includes comprehensive health checks:

- **Connection Health**: Verifies database connectivity
- **Table Count**: Monitors number of tables
- **Migration Status**: Tracks applied migrations
- **Connection Pool**: Monitors active connections

Check database health with:

```bash
bun run db:info
```

## Troubleshooting

### Common Issues

1. **Connection Refused Error**
   - Ensure Docker containers are running: `docker ps`
   - Start containers: `bun run docker:up`
   - Check logs: `bun run docker:logs`

2. **Database Does Not Exist**
   - The Docker container should auto-create databases
   - Check if initialization completed: `docker logs blockchain-monitor-db`
   - Manually create if needed through `docker exec`

3. **Migration Failures**
   - Check current migration status: `bun run db:info`
   - Reset if needed: `bun run db:reset`
   - Re-run migrations: `bun run db:migrate`

4. **SSL Connection Issues (Production)**
   - Ensure `NODE_ENV=production` is set
   - Verify SSL is enabled in connection string
   - Check cloud provider SSL requirements

### Debug Commands

```bash
# Check all environment connections
bun run db:test-connections

# View detailed database info
bun run db:info

# Check Docker container status
docker ps

# View PostgreSQL logs
docker logs blockchain-monitor-db

# Access PostgreSQL CLI
docker exec -it blockchain-monitor-db psql -U dev_user -d blockchain_monitoring_dev
```

## Notes and Limitations

1. **Schema Status**: Currently using a placeholder schema that will be expanded
2. **Seeding Logic**: Basic seeding implementation pending full schema definition
3. **Migration Rollback**: Not yet implemented - use reset + migrate as workaround
4. **Test Isolation**: Test database runs on separate port (5433) to avoid conflicts

## Best Practices

1. Always run tests before deploying changes
2. Use `db:info` to verify connection before operations
3. Keep development and test databases separate
4. Never run `db:reset` on production
5. Always backup before major migrations
6. Use environment-specific setup scripts (`db:setup:dev`, `db:setup:test`)
7. Monitor connection pool usage in production
