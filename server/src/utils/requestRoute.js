// Express unwinds baseUrl on error paths. Recover only known mount prefixes,
// and retain the route template instead of logging IDs, query values or bodies.
export function requestRoute(req) {
  if (typeof req.route?.path !== 'string') return 'unmatched_route';
  const template = req.route.path;
  const segments = (req.originalUrl || '').split('?')[0].split('/').filter(Boolean);
  const count = template.split('/').filter(Boolean).length;
  const prefix = '/' + segments.slice(0, segments.length - count).join('/');
  if (!['/', '/api/v1', '/api/v1/auth', '/api/v1/users', '/api/v1/reports'].includes(prefix)) return 'unmatched_route';
  return (prefix === '/' ? '' : prefix) + template;
}
