import { ButtonLink, EmptyState } from '../components/ui';
export default function NotFoundPage() { return <div className="container page-section"><EmptyState title="This page has wandered off." action={<ButtonLink to="/">Back to home</ButtonLink>}>We couldn’t find that address. Let’s get you back on track.</EmptyState></div>; }
