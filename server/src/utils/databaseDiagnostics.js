// Classify driver failures without logging raw messages, URIs, hosts or credentials.
export function databaseDiagnostic(error) {
  const errors = [];
  const seen = new Set();
  function visit(current) {
    if (!current || typeof current !== 'object' || seen.has(current) || errors.length >= 16) return;
    seen.add(current);
    errors.push(current);
    visit(current.cause);
    if (current.reason?.servers instanceof Map) {
      for (const server of current.reason.servers.values()) visit(server.error);
    }
  }
  visit(error);
  const matches = (pattern) => errors.some((entry) => pattern.test(String(entry.message || '')));
  const hasCode = (...codes) => errors.some((entry) => codes.includes(entry.code));
  const errorType = ['MongoParseError', 'MongoAPIError', 'MongoServerError', 'MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError'].includes(error?.name) ? error.name : 'Error';
  const code = errors.find((entry) => typeof entry.code === 'number' || ['ECONNREFUSED', 'ENOTFOUND', 'ENODATA', 'EAI_AGAIN', 'ETIMEOUT', 'ETIMEDOUT', 'ECONNRESET'].includes(entry.code))?.code;
  const base = { errorType, ...(code !== undefined ? { errorCode: code } : {}) };
  if (errors.some((entry) => entry.name === 'MongoParseError') || matches(/invalid (?:connection string|scheme)|unescaped|URI malformed/i)) {
    return { ...base, category: 'invalid_uri', message: 'Check MONGODB_URI syntax and percent-encoding of username/password characters.' };
  }
  if (hasCode(18) || matches(/authentication failed|bad auth|auth failed/i)) {
    return { ...base, category: 'authentication', message: 'Atlas rejected database authentication. Check the database user, password encoding and authSource.' };
  }
  if (hasCode(13) || matches(/not authorized|unauthorized/i)) {
    return { ...base, category: 'authorization', message: 'The database user lacks permission for this operation. Check its roles on the intended database.' };
  }
  if (errors.some((entry) => /^query(?:Srv|Txt)$/i.test(entry.syscall || '')) || hasCode('ENOTFOUND', 'ENODATA', 'EAI_AGAIN') || matches(/querySrv|queryTxt/i)) {
    return { ...base, category: 'dns', message: 'Atlas DNS discovery failed. Verify the cluster hostname and SRV/TXT resolution. MONGODB_DNS_SERVERS can explicitly configure resolvers for this backend process.' };
  }
  if (matches(/TLS|SSL|certificate/i)) {
    return { ...base, category: 'tls', message: 'TLS negotiation failed. Check certificate trust, system time and network interception; keep certificate validation enabled.' };
  }
  if (hasCode('ECONNREFUSED', 'ETIMEDOUT', 'ETIMEOUT', 'ECONNRESET') || matches(/server selection|timed out|timeout/i) || /ServerSelectionError$/.test(errorType)) {
    return { ...base, category: 'network', message: 'Atlas could not be reached. Check cluster availability, outbound connectivity and the Atlas IP access list. This error alone does not identify which condition failed.' };
  }
  return { ...base, category: 'database_initialization', message: 'Database initialization failed. Check database access and collection/index setup. Raw driver errors are intentionally excluded from logs.' };
}
