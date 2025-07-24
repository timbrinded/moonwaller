import { describe, it, expect } from 'bun:test';
import { config } from '../../shared/config';

describe('Configuration', () => {
  it('should load test configuration during testing', () => {
    expect(config.env).toBe('test');
    expect(config.server.port).toBe(3000);
    expect(config.database.url).toContain('blockchain_monitoring_test');
  });

  it('should have required configuration properties', () => {
    expect(config.database.url).toBeDefined();
    expect(config.server.port).toBeGreaterThan(0);
    expect(config.jwt.secret).toBeDefined();
    expect(config.api.key).toBeDefined();
  });
});
