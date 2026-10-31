import { useCallback, useEffect, useState } from 'react';
import { Activity, Database, RefreshCw, Server } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Button, ErrorNotice, Skeleton } from '../components/ui';

export default function StatusPage() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [checkedAt, setCheckedAt] = useState(null);
  const check = useCallback(async () => {
    setBusy(true); setError('');
    try { const { data } = await api.get('/health'); setStatus(data.data); setCheckedAt(new Date()); }
    catch (failure) { setStatus(null); setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { check(); }, [check]);
  return <div className="container page-section status-page"><div className="page-heading"><span className="icon-tile"><Activity size={24} /></span><p className="eyebrow">CONNECTED TO THE REAL API</p><h1>Service status</h1><p>A live check of the services powering your ClaimBack account.</p></div><section className="panel">{error && <ErrorNotice>{error}</ErrorNotice>}{busy ? <div role="status" aria-label="Checking services"><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line" /></div> : status && <><div className="status-row"><span><Server size={21} /> ClaimBack API</span><span className="status-badge">Operational</span></div><div className="status-row"><span><Database size={21} /> Database</span><span className={`status-badge ${status.database !== 'connected' ? 'warning' : ''}`}>{status.database === 'connected' ? 'Connected' : 'Unavailable'}</span></div>{status.database !== 'connected' && <p className="status-explanation">Account features are temporarily unavailable because the database is not connected. The website is still available.</p>}</>}<div className="status-actions"><small className="muted">{checkedAt ? `Last checked ${checkedAt.toLocaleTimeString()}` : 'No successful check yet'}</small><Button variant="outline" loading={busy} onClick={check}><RefreshCw size={16} /> Refresh</Button></div></section><p className="status-footnote">This check verifies the API and database. Gemini and Cloudinary availability is checked when analysis or uploads are requested; reports show explicit fallback states when unavailable.</p></div>;
}
