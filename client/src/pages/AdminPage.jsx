import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { useToast } from '../contexts/ToastContext';
import { api, errorMessage } from '../lib/api';
import { Button, Field, EmptyState, ErrorNotice } from '../components/ui';
import { AppNav, PageHead, ResourceState, Pagination, Badge, TextArea, date, label } from '../components/application';
function AdminList({ tab }) {
  const [page, setPage] = useState(1), [filter, setFilter] = useState(''), [busy, setBusy] = useState('');
  const [pending, setPending] = useState(null), [error, setError] = useState('');
  const resource = useResource(tab === 'claims' ? `/claims?scope=review&status=${filter || 'pending'}&page=${page}` : `/admin/${tab}?page=${page}&q=${encodeURIComponent(filter)}`), notify = useToast();
  async function update(event) {
    event.preventDefault();
    const item = pending;
    if (!item || busy) return;
    const id = item.id || item._id;
    const payload = tab === 'reports'
      ? { moderation: item.moderation === 'visible' ? 'hidden' : 'visible', reason: new FormData(event.currentTarget).get('reason').trim() }
      : { status: item.status === 'active' ? 'suspended' : 'active' };
    setBusy(id); setError('');
    try { await api.patch(`/admin/${tab}/${id}`, payload); notify('Updated successfully.'); setPending(null); resource.reload(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  const confirmation = pending && (tab === 'reports' ? pending.moderation === 'visible' ? 'Confirm hide' : 'Confirm restore' : pending.status === 'active' ? 'Confirm suspension' : 'Confirm reactivation');
  return <>{tab === 'claims' && <div className="tab-row">{['pending', 'approved', 'handed_over', 'rejected'].map((status) => <button key={status} className={(filter || 'pending') === status ? 'active' : ''} onClick={() => { setFilter(status); setPage(1); }}>{label(status)}</button>)}</div>}{tab === 'users' && <form className="inline-search" onSubmit={(event) => { event.preventDefault(); setFilter(new FormData(event.currentTarget).get('q')); setPage(1); }}><Field id="user-search" name="q" label="Find users" placeholder="Name or email" maxLength={100} /><Button>Search</Button></form>}
    {pending && <form key={pending.id || pending._id} className="panel form-stack section-block" aria-label={tab === 'reports' ? 'Confirm report moderation' : 'Confirm account status'} onSubmit={update}>
      <h2>{tab === 'reports' ? 'Confirm report moderation' : 'Confirm account status'}</h2>
      <p>{tab === 'reports' ? `${pending.moderation === 'visible' ? 'Hide' : 'Restore'} “${pending.title}”. The report owner will receive your reason.` : `${pending.status === 'active' ? 'Suspend' : 'Reactivate'} “${pending.name}”. Existing sessions will be revoked.`}</p>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      <fieldset disabled={Boolean(busy)}>{tab === 'reports' && <TextArea id="moderation-reason" name="reason" label="Moderation reason" required minLength={5} maxLength={300} rows={3} autoFocus />}
        <div className="form-actions"><Button type="submit" loading={Boolean(busy)}>{confirmation}</Button><Button type="button" variant="ghost" onClick={() => { setPending(null); setError(''); }}>Cancel</Button></div>
      </fieldset>
    </form>}
    <ResourceState resource={resource}>{(data) => <>{data.items.length ? <div className="list-panel">{data.items.map((item) => <article className="list-row admin-row" key={item.id || item._id}><div><strong>{tab === 'users' ? item.name : tab === 'reports' ? item.title : `Claim #${item.id.slice(-6).toUpperCase()}`}</strong><p>{tab === 'users' ? item.email : tab === 'reports' ? `${item.type} · ${item.location}` : `Submitted ${date(item.createdAt)}`}</p>{tab === 'reports' && <details className="moderation-detail"><summary>Inspect report</summary><p className="preserve-text">{item.description}</p><p>{item.category} · {item.colour || 'Colour not provided'} · {date(item.occurredAt)} · {item.status}</p><div className="image-previews">{item.images.map((image) => <a href={image.url} target="_blank" rel="noreferrer" key={image.url}><img src={image.url} alt={item.title} /></a>)}</div></details>}</div><Badge>{tab === 'reports' ? item.moderation : label(item.status)}</Badge>{tab === 'claims' ? <Link className="button button-outline" to={`/claims/${item.id}`}>Review evidence</Link> : <Button variant="outline" loading={busy === (item.id || item._id)} disabled={Boolean(busy) || (tab === 'users' && item.role === 'admin')} onClick={() => { setPending(item); setError(''); }}>{tab === 'reports' ? item.moderation === 'visible' ? 'Hide report' : 'Restore report' : item.role === 'admin' ? 'Administrator' : item.status === 'active' ? 'Suspend' : 'Reactivate'}</Button>}</article>)}</div> : <EmptyState title="Nothing to review here">This view is up to date.</EmptyState>}<Pagination data={data} onPage={setPage} /></>}</ResourceState></>;
}
export default function AdminPage() {
  const [tab, setTab] = useState('claims'), resource = useResource('/admin/stats');
  return <section className="container page-section"><AppNav /><PageHead eyebrow="CARE, ACCOUNTABILITY, AND HUMAN JUDGMENT" title="Administration">Review ownership evidence, moderate reports and help record safe returns.</PageHead><ResourceState resource={resource}>{(data) => <><div className="stats-grid admin-stats">{[['Total users', data.users], ['Lost reports', data.reports.find((r) => r._id === 'lost')?.total || 0], ['Found reports', data.reports.find((r) => r._id === 'found')?.total || 0], ['Pending claims', data.claims.find((c) => c._id === 'pending')?.total || 0], ['Recoveries', data.claims.find((c) => c._id === 'handed_over')?.total || 0]].map(([title, value]) => <div className="stat-card" key={title}><span>{title}</span><strong>{value}</strong></div>)}</div><details className="panel analytics-panel"><summary>Report categories · live analytics</summary><div className="category-bars">{data.categories.length ? data.categories.map((c) => <div key={c._id}><span>{c._id}</span><meter min="0" max={Math.max(...data.categories.map((r) => r.total))} value={c.total} aria-label={`${c._id}: ${c.total} reports`} /><strong>{c.total}</strong></div>) : <p>No reports yet.</p>}</div></details></>}</ResourceState><div className="tab-row admin-tabs" role="tablist" aria-label="Administration sections">{[['claims', 'Claim review'], ['reports', 'Report moderation'], ['users', 'User management']].map(([value, title]) => <button role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} key={value} onClick={() => { setTab(value); resource.reload(); }}>{title}</button>)}</div><AdminList key={tab} tab={tab} /></section>;
}
