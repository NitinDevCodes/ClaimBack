import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { databaseDiagnostic } from '../src/utils/databaseDiagnostics.js';
import { parseEnv } from '../src/config/env.js';

describe('safe MongoDB diagnostics', () => {
  const secret = 'mongodb+srv://private-user:private-password@private-host/claimback';
  it('identifies SRV refusal without exposing the raw message or credentials', () => {
    const result = databaseDiagnostic(Object.assign(new Error(`querySrv ECONNREFUSED ${secret}`), { code: 'ECONNREFUSED', syscall: 'querySrv' }));
    assert.equal(result.category, 'dns');
    assert.equal(result.errorCode, 'ECONNREFUSED');
    for (const value of ['private-user', 'private-password', 'private-host', secret]) assert.equal(JSON.stringify(result).includes(value), false);
  });
  it('distinguishes authentication, authorization and URI errors', () => {
    assert.equal(databaseDiagnostic(Object.assign(new Error(secret), { name: 'MongoServerError', code: 18 })).category, 'authentication');
    assert.equal(databaseDiagnostic(Object.assign(new Error(secret), { name: 'MongoServerError', code: 13 })).category, 'authorization');
    assert.equal(databaseDiagnostic(Object.assign(new Error(secret), { name: 'MongoParseError' })).category, 'invalid_uri');
  });
  it('examines nested topology failures without guessing an IP allowlist cause', () => {
    const error = Object.assign(new Error('Server selection timed out'), { name: 'MongoServerSelectionError', reason: { servers: new Map([['private-host', { error: Object.assign(new Error(secret), { code: 'ETIMEDOUT' }) }]]) } });
    const result = databaseDiagnostic(error);
    assert.equal(result.category, 'network');
    assert.equal(result.errorCode, 'ETIMEDOUT');
    assert.equal(JSON.stringify(result).includes('private-host'), false);
    assert.match(result.message, /does not identify/);
  });
  it('distinguishes certificate failures and handles unknown or cyclic errors safely', () => {
    assert.equal(databaseDiagnostic(new Error(`TLS certificate failure ${secret}`)).category, 'tls');
    const error = new Error(secret);
    error.cause = error;
    assert.equal(databaseDiagnostic(error).category, 'database_initialization');
    assert.equal(JSON.stringify(databaseDiagnostic(error)).includes('private-password'), false);
  });
  it('uses default DNS unless explicitly configured and validates overrides', () => {
    assert.deepEqual(parseEnv({ NODE_ENV: 'test' }).databaseDnsServers, []);
    assert.deepEqual(parseEnv({ NODE_ENV: 'test', MONGODB_DNS_SERVERS: '1.1.1.1, 8.8.8.8' }).databaseDnsServers, ['1.1.1.1', '8.8.8.8']);
    for (const value of ['resolver.example', '1.1.1.1,', 'invalid', '999.1.1.1']) assert.throws(() => parseEnv({ MONGODB_DNS_SERVERS: value }), /MONGODB_DNS_SERVERS/);
  });
});
