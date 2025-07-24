import { config } from '../shared/config';

console.log('🚀 Starting Blockchain Monitoring Dashboard Server');
console.log(`📊 Environment: ${config.env}`);
console.log(`🔌 Server will run on port: ${config.server.port}`);
console.log(
  `🗄️  Database: ${config.database.url.replace(/:[^:@]*@/, ':***@')}`
);

// Basic server setup - will be expanded in future tasks
const server = Bun.serve({
  port: config.server.port,
  hostname: config.server.host,

  async fetch(request) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          environment: config.env,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // API routes will be implemented in future tasks
    if (url.pathname.startsWith('/api')) {
      return new Response(
        JSON.stringify({
          message: 'API endpoints will be implemented in future tasks',
        }),
        {
          status: 501,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Default response
    return new Response('Blockchain Monitoring Dashboard - Server Running', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },

  error(error) {
    console.error('Server error:', error);
    return new Response('Internal Server Error', { status: 500 });
  },
});

console.log(
  `✅ Server running at http://${config.server.host}:${config.server.port}`
);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  server.stop();
  process.exit(0);
});
