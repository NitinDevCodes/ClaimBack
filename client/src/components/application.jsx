import { Link, NavLink } from 'react-router-dom';
import { MapPin, CalendarDays, PackageSearch, ArrowUpRight, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, ButtonLink, ErrorNotice, PageLoading } from './ui';
export const categories = ['electronics', 'bags', 'wallets', 'keys', 'documents', 'jewellery', 'clothing', 'other'];
export const date = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const label = (value = '') => value.replaceAll('_', ' ');
export function Badge({ children, tone = '' }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function AppNav() {
  const { user } = useAuth();
  return <nav className="app-nav" aria-label="Workspace"><NavLink to="/dashboard" end>Overview</NavLink><NavLink to="/my-reports">My reports</NavLink><NavLink to="/claims" end>My claims</NavLink><NavLink to="/notifications">Notifications</NavLink><NavLink to="/account">Profile</NavLink>{user?.role === 'admin' && <NavLink to="/admin">Administration</NavLink>}</nav>;
}
export function PageHead({ eyebrow, title, children, action, level = 1 }) { const Heading = level === 1 ? 'h1' : 'h2'; return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<Heading>{title}</Heading>{children && <p className="muted">{children}</p>}</div>{action}</div>; }
export function ResourceState({ resource, children }) {
  if (resource.loading) return <PageLoading />;
  if (resource.error) return <ErrorNotice retry={resource.reload}>{resource.error}</ErrorNotice>;
  return resource.data ? children(resource.data) : null;
}
export function Pagination({ data, onPage }) { return data.pages > 1 && <div className="pagination"><Button variant="outline" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</Button><span>Page {data.page} of {data.pages}</span><Button variant="outline" disabled={data.page >= data.pages} onClick={() => onPage(data.page + 1)}>Next</Button></div>; }
export function ReportCard({ report, children, manage = false }) { return <article className="report-card"><Link to={manage ? `/reports/${report.id}/edit` : `/reports/${report.id}`} className="report-card-image" aria-label={`View ${report.title}`}>
  {report.images?.length ? <img src={report.images[0].url} alt={report.title} loading="lazy" /> : <div className="no-image"><PackageSearch size={40} strokeWidth={1.25} /><span>No photo provided</span></div>}
  <Badge tone={report.type}>{report.type}</Badge></Link><div className="report-card-body"><div className="card-meta"><span>{report.category}</span><span>{label(report.status)}</span></div><h2><Link to={manage ? `/reports/${report.id}/edit` : `/reports/${report.id}`}>{report.title}</Link></h2><p className="truncate-lines">{report.description}</p><div className="item-meta"><span><MapPin size={14} />{report.location}</span><span><CalendarDays size={14} />{date(report.occurredAt)}</span></div>{report.moderation === 'hidden' && <Badge tone="warning">Hidden by moderation</Badge>}{children}</div></article>; }
export function MatchCard({ match, sourceTitle, onInterest, busy }) { return <article className="match-card"><div className="match-score"><Sparkles size={18} /><strong>{match.score}<small>/100</small></strong><span>similarity</span></div><div className="match-content"><Badge>{match.method === 'gemini' ? 'Gemini + attributes' : 'Attribute fallback'}</Badge><h3><Link to={`/reports/${match.report.id}`}>{match.report.title} <ArrowUpRight size={15} /></Link></h3>{sourceTitle && <p className="field-hint">For: {sourceTitle}</p>}<p>{match.explanation || match.report.description}</p><span className="field-hint">{match.report.location} · {date(match.report.occurredAt)}</span>{onInterest && <div className="form-actions"><Button variant="outline" disabled={match.interested} loading={busy} onClick={onInterest}>{match.interested ? 'Interest sent' : 'Express interest'}</Button><ButtonLink to={`/reports/${match.report.id}`} variant="ghost">View report</ButtonLink></div>}</div></article>; }
export function TextArea({ label: title, id, hint, ...props }) { return <div className="field"><label htmlFor={id}>{title}</label><textarea id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />{hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}</div>; }
export function Select({ label: title, id, children, ...props }) { return <div className="field"><label htmlFor={id}>{title}</label><select id={id} {...props}>{children}</select></div>; }
