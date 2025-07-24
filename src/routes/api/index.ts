import { json } from '@solidjs/router';

export async function GET() {
  return json({
    message: 'Blockchain Monitoring Dashboard API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      reports: '/api/reports (coming soon)',
      analytics: '/api/analytics (coming soon)',
    },
  });
}
