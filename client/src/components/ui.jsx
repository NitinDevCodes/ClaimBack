import { AlertCircle, ArrowRight, LoaderCircle, PackageSearch } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Button({ children, variant = 'primary', loading = false, disabled = false, className = '', ...props }) {
  return <button className={`button button-${variant} ${className}`} disabled={loading || disabled} aria-busy={loading} {...props}>
    {loading && <LoaderCircle className="spin" size={17} />} {children}
  </button>;
}
export function ButtonLink({ children, to, variant = 'primary', arrow = false, ...props }) {
  return <Link to={to} className={`button button-${variant}`} {...props}>{children}{arrow && <ArrowRight size={17} />}</Link>;
}
export function Field({ label, error, hint, id, ...props }) {
  return <div className="field"><label htmlFor={id}>{label}</label>
    <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...props} />
    {error ? <span className="field-error" id={`${id}-error`}>{error}</span> : hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}
  </div>;
}
export function ErrorNotice({ children, retry }) {
  return <div className="error-notice" role="alert"><AlertCircle size={19} /><div><p>{children}</p>{retry && <button className="text-link" onClick={retry}>Try again</button>}</div></div>;
}
export function Skeleton({ className = '' }) { return <div aria-hidden="true" className={`skeleton ${className}`} />; }
export function PageLoading() { return <div className="container page-section" role="status" aria-label="Loading page"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-panel" /><span className="sr-only">Loading…</span></div>; }
export function EmptyState({ title, children, action }) {
  return <div className="empty-state"><div className="icon-tile"><PackageSearch size={26} /></div><h2>{title}</h2><p>{children}</p>{action}</div>;
}
