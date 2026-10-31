import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
export function useResource(path) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: '' });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!path) { setState({ data: null, loading: false, error: '' }); return; }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: '' }));
    api.get(path, { signal: controller.signal, timeout: 90000 }).then((response) => {
      if (!controller.signal.aborted) setState({ data: response.data.data, loading: false, error: '' });
    }).catch((error) => { if (!controller.signal.aborted) setState({ data: null, loading: false, error: errorMessage(error) }); });
    return () => controller.abort();
  }, [path, version]);
  return { ...state, reload };
}
