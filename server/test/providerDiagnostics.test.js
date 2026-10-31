import { it } from 'node:test';
import assert from 'node:assert/strict';
import { providerDiagnostic } from '../src/utils/providerDiagnostics.js';
it('classifies provider failures without copying credentials, private bodies or arbitrary codes', () => {
  for (const [status, category] of [[400, 'invalid_request'], [401, 'authentication_or_permission'], [403, 'authentication_or_permission'], [404, 'model_or_resource_not_found'], [429, 'quota_or_rate_limit'], [503, 'provider_unavailable']]) {
    assert.deepEqual(providerDiagnostic({ status, message: 'secret', request: 'private', code: 'secret' }), { category, status });
  }
  assert.deepEqual(providerDiagnostic({ name: 'ZodError', message: 'private' }), { category: 'invalid_response' });
  assert.deepEqual(providerDiagnostic({ name: 'TimeoutError', message: 'secret' }), { category: 'timeout' });
  assert.deepEqual(providerDiagnostic({ status: 'secret', message: 'secret' }), { category: 'request_failed' });
});
