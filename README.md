# Blockchain Monitoring Dashboard

A lightweight three-tier web application that receives JSON test reports from the moonwall testing framework, stores them in a database, and serves live monitoring data through a scalable web interface.

## Technology Stack

- **Runtime**: Bun - Fast startup, built-in TypeScript support
- **Frontend**: SolidJS + SolidStart - Fine-grained reactivity and optimal performance
- **Database**: PostgreSQL with JSONB support
- **Styling**: Tailwind CSS - Utility-first styling
- **ORM**: Drizzle ORM - Type-safe database operations

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- [Docker](https://docker.com) and Docker Compose
- [Git](https://git-scm.com)

### Development Setup

1. **Clone and install dependencies**:

   ```bash
   git clone <repository-url>
   cd blockchain-monitoring-dashboard
   bun install
   ```

2. **Set up environment variables**:

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start the database**:

   ```bash
   bun run docker:up
   ```

4. **Start the development server**:

   ```bash
   bun run dev
   ```

The application will be available at:

- Frontend: <http://localhost:3000> (or 3001 if 3000 is busy)
- API endpoints: <http://localhost:3000/api>
- Health check: <http://localhost:3000/api/health>

## Available Scripts

### Development

- `bun run dev` - Start SolidStart development server with hot reload
- `bun run server:dev` - Start backend server only with hot reload
- `bun run docker:up` - Start PostgreSQL and Redis with Docker Compose
- `bun run docker:down` - Stop Docker services

### Testing

- `bun test` - Run all tests
- `bun run test:watch` - Run tests in watch mode
- `bun run test:coverage` - Run tests with coverage report
- `bun run test:integration` - Run integration tests

### Database

- `bun run db:generate` - Generate database migrations
- `bun run db:migrate` - Apply database migrations
- `bun run db:seed` - Seed database with development data
- `bun run db:studio` - Open Drizzle Studio
- `bun run db:reset` - Reset database

### Production

- `bun run build` - Build for production
- `bun run start` - Start production server

## Project Structure

```
src/
├── server/              # Backend server code
│   ├── api/             # REST API endpoints
│   ├── websocket/       # WebSocket handlers
│   ├── services/        # Business logic services
│   └── middleware/      # Request/response middleware
├── db/                  # Database layer
│   ├── migrations/      # Database migration files
│   ├── queries/         # Reusable query functions
│   └── schema.ts        # Drizzle schema definitions
├── frontend/            # SolidJS application
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route-based page components
│   ├── services/        # Frontend API services
│   └── stores/          # Global state management
├── shared/              # Shared types and utilities
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Common utility functions
└── tests/               # Test files
    ├── unit/            # Unit tests
    ├── integration/     # Integration tests
    └── fixtures/        # Test data and mocks
```

## Features (Planned)

- ✅ Project foundation and development environment
- ⏳ Database layer with Drizzle ORM
- ⏳ Core backend API with Bun server
- ⏳ Real-time WebSocket communication
- ⏳ SolidJS frontend with advanced data tables
- ⏳ Performance optimizations and caching
- ⏳ Comprehensive testing suite
- ⏳ Production deployment configuration

## Contributing

This project follows the spec-driven development methodology. See the `.kiro/specs/blockchain-monitoring-dashboard/` directory for detailed requirements, design, and implementation tasks.

## License

Private project - All rights reserved.
