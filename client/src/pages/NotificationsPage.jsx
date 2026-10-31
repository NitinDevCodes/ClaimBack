import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { useToast } from '../contexts/ToastContext';
import { api, errorMessage } from '../lib/api';
import { Button, EmptyState } from '../components/ui';
import { AppNav, PageHead, ResourceState, Pagination, Badge, date } from '../components/application';
export default function NotificationsPage() {
  const [page, setPage] = useState(1), [busy, setBusy] = useState(''), resource = useResource(`/notifications?page=${page}`), notify = useToast();
  async function read(id) { setBusy(id); try { await api.patch(`/notifications/${id}/read`, {}); resource.reload(); } catch (e) { notify(errorMessage(e), 'error'); } finally { setBusy(''); } }
  return <section className="container page-section"><AppNav /><PageHead eyebrow="KEEPING YOU IN THE LOOP" title="Notifications" action={<Button variant="outline" loading={busy === 'all'} onClick={() => read('all')}>Mark all as read</Button>}>Possible matches, claim decisions and recovery updates.</PageHead><ResourceState resource={resource}>{(data) => <><p className="results-count">{data.unread} unread updates</p>{data.items.length ? <div className="list-panel">{data.items.map((n) => <article className={`notification-row ${!n.readAt ? 'unread' : ''}`} key={n._id}><div><div className="notification-title"><h2>{n.title}</h2>{!n.readAt && <Badge>New</Badge>}</div><p>{n.message}</p><span className="field-hint">{date(n.createdAt)}</span></div><div className="form-actions">{n.href && <Link to={n.href} className="text-link" onClick={() => { if (!n.readAt) read(n._id); }}>View →</Link>}{!n.readAt && <Button variant="ghost" loading={busy === n._id} onClick={() => read(n._id)}>Mark read</Button>}</div></article>)}</div> : <EmptyState title="You’re all caught up">Updates will appear here as your recovery journey progresses.</EmptyState>}<Pagination data={data} onPage={setPage} /></>}</ResourceState></section>;
}
