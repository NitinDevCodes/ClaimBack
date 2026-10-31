// Never return raw provider messages: they may embed request bodies or credentials.
export function providerDiagnostic(error) {
  const status = Number(error?.status || error?.http_code);
  const category = status === 400 ? 'invalid_request' : [401, 403].includes(status) ? 'authentication_or_permission'
    : status === 404 ? 'model_or_resource_not_found' : status === 429 ? 'quota_or_rate_limit'
      : status >= 500 && status <= 599 ? 'provider_unavailable'
        : ['ZodError', 'SyntaxError'].includes(error?.name) || error?.message === 'InvalidResponse' ? 'invalid_response'
          : /timeout|abort/i.test(error?.name || '') ? 'timeout' : 'request_failed';
  // Emit only fixed labels, including when the SDK wraps a JSON error in a string.
  const message = typeof error?.message === 'string' ? error.message : '';
  const reason = status === 503 && /this model is currently experiencing high demand/i.test(message) ? 'model_capacity'
    : status === 504 && /deadline expired|deadline_exceeded/i.test(message) ? 'deadline_exceeded' : undefined;
  return { category, ...(Number.isInteger(status) && status >= 400 && status <= 599 ? { status } : {}), ...(reason ? { reason } : {}) };
}
