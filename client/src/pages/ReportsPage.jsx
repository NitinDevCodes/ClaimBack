import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useResource } from '../hooks/useResource';
import { Button, ButtonLink, EmptyState, Field } from '../components/ui';
import { AppNav, PageHead, ResourceState, ReportCard, Pagination, Select, categories } from '../components/application';
export default function ReportsPage({ mine = false }) {
  const [params, setParams] = useSearchParams();
  const resource = useResource(`${mine ? '/reports/mine' : '/reports'}?${params}`);
  function search(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) if (value) next.set(key, value);
    setParams(next);
  }
  return <section className="container page-section">{mine && <AppNav />}<PageHead eyebrow={mine ? 'YOUR RECOVERY WORKSPACE' : 'A COMMUNITY THAT LOOKS OUT FOR EACH OTHER'} title={mine ? 'My reports' : 'Every detail is a lead.'} action={<ButtonLink to="/reports/new">Report an item</ButtonLink>}>{mine ? 'Manage your reports, review suggestions, and keep details current.' : 'Explore lost and found items. A similar report could be the beginning of a reunion.'}</PageHead>
    {!mine && <form className="filter-panel panel" onSubmit={search}><div className="filter-search"><Field id="q" label="Search items" name="q" defaultValue={params.get('q') || ''} placeholder="Backpack, keys, headphones…" /><Select id="type" label="Report type" name="type" defaultValue={params.get('type') || ''}><option value="">Lost & found</option><option value="lost">Lost items</option><option value="found">Found items</option></Select><Select id="category" label="Category" name="category" defaultValue={params.get('category') || ''}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</Select></div><div className="filter-detail"><Field id="location" label="Location" name="location" defaultValue={params.get('location') || ''} placeholder="Area or landmark" /><Field id="from" label="From date" name="from" type="date" defaultValue={params.get('from') || ''} /><Field id="to" label="To date" name="to" type="date" defaultValue={params.get('to') || ''} /><Select id="status" label="Status" name="status" defaultValue={params.get('status') || 'open'}><option value="open">Open</option><option value="recovered">Recovered</option><option value="closed">Closed</option></Select><Button type="submit"><Search size={16} />Search</Button></div></form>}
    {mine && <div className="tab-row">{[['', 'All reports'], ['lost', 'Lost reports'], ['found', 'Found reports']].map(([value, title]) => <button key={title} className={(params.get('type') || '') === value ? 'active' : ''} onClick={() => setParams(value ? { type: value } : {})}>{title}</button>)}</div>}
    <ResourceState resource={resource}>{(data) => <><p className="results-count">{data.total} {data.total === 1 ? 'report' : 'reports'}</p>{data.items.length ? <div className="report-grid">{data.items.map((r) => <ReportCard key={r.id} report={r} manage={mine && r.moderation === 'hidden'}>{mine && <div className="form-actions"><ButtonLink to={`/reports/${r.id}/edit`} variant="outline">Manage report</ButtonLink></div>}</ReportCard>)}</div> : <EmptyState title={mine ? 'No reports in this view yet' : 'No reports match these filters'} action={<ButtonLink to="/reports/new">Report an item</ButtonLink>}>{mine ? 'Add what you know. You can update details and review potential matches later.' : 'Try another category, location, or date range.'}</EmptyState>}<Pagination data={data} onPage={(page) => { const next = new URLSearchParams(params); next.set('page', page); setParams(next); }} /></>}</ResourceState>
  </section>;
}
