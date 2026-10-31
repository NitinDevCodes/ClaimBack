import { it } from 'node:test';
import assert from 'node:assert/strict';
import { providerDiagnostic } from '../src/utils/providerDiagnostics.js';
import { requestRoute } from '../src/utils/requestRoute.js';
it('classifies provider failures without copying credentials, private bodies or arbitrary codes', () => {
  for (const [status, category] of [[400, 'invalid_request'], [401, 'authentication_or_permission'], [403, 'authentication_or_permission'], [404, 'model_or_resource_not_found'], [429, 'quota_or_rate_limit'], [503, 'provider_unavailable']]) {
    assert.deepEqual(providerDiagnostic({ status, message: 'secret', request: 'private', code: 'secret' }), { category, status });
  }
  assert.deepEqual(providerDiagnostic({ name: 'ZodError', message: 'private' }), { category: 'invalid_response' });
  assert.deepEqual(providerDiagnostic({ name: 'TimeoutError', message: 'secret' }), { category: 'timeout' });
  assert.deepEqual(providerDiagnostic({ status: 'secret', message: 'secret' }), { category: 'request_failed' });
  assert.deepEqual(providerDiagnostic({ status: 503, message: JSON.stringify({ error: { message: 'This model is currently experiencing high demand. secret' } }) }), { category: 'provider_unavailable', status: 503, reason: 'model_capacity' });
  assert.deepEqual(providerDiagnostic({ status: 504, message: 'Deadline expired before operation could complete. secret' }), { category: 'provider_unavailable', status: 504, reason: 'deadline_exceeded' });
});
it('logs canonical routes after Express error unwinding without query values or record IDs', () => {
  assert.equal(requestRoute({ originalUrl: '/api/v1/auth/me?private=secret', baseUrl: '', route: { path: '/me' } }), '/api/v1/auth/me');
  assert.equal(requestRoute({ originalUrl: '/api/v1/reports/123456789012345678901234', route: { path: '/:id' } }), '/api/v1/reports/:id');
  assert.equal(requestRoute({ originalUrl: '/api/v1/health', route: { path: '/api/v1/health' } }), '/api/v1/health');
  assert.equal(requestRoute({ originalUrl: '/unknown/secret' }), 'unmatched_route');
});
