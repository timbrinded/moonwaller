import { json } from '@solidjs/router';
import { config } from '../../shared/config';

export async function GET() {
  return json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env,
    version: '1.0.0',
  });
}
