// Never pass request bodies, headers, database URIs, or provider errors here.
export const logger = {
  info(event, fields = {}) { console.log(JSON.stringify({ level: 'info', time: new Date().toISOString(), event, ...fields })); },
  error(event, fields = {}) { console.error(JSON.stringify({ level: 'error', time: new Date().toISOString(), event, ...fields })); },
};
