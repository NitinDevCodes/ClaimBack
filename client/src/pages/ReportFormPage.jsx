import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ImagePlus, ShieldCheck, Sparkles } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useResource } from '../hooks/useResource';
import { useToast } from '../contexts/ToastContext';
import { Button, Field, ErrorNotice, PageLoading } from '../components/ui';
import { PageHead, Select, TextArea, categories, Badge } from '../components/application';

export default function ReportFormPage() {
  const { id } = useParams();
  const resource = useResource(id ? `/reports/${id}/manage` : null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [files, setFiles] = useState([]), [previews, setPreviews] = useState([]);
  const navigate = useNavigate(), notify = useToast();
  useEffect(() => { const urls = files.map((file) => URL.createObjectURL(file)); setPreviews(urls); return () => urls.forEach(URL.revokeObjectURL); }, [files]);
  if (id && resource.loading) return <PageLoading />;
  if (id && resource.error) return <section className="container page-section"><ErrorNotice retry={resource.reload}>{resource.error}</ErrorNotice></section>;
  const report = resource.data;
  const locked = ['reserved', 'recovered'].includes(report?.status);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const data = new FormData(event.currentTarget);
    data.delete('images'); files.forEach((file) => data.append('images', file));
    if (id) data.set('revision', report.revision);
    try {
      const response = await api({ method: id ? 'patch' : 'post', url: id ? `/reports/${id}` : '/reports', data, headers: { 'Content-Type': undefined }, timeout: 120000 });
      const saved = id ? response.data.data : response.data.data.report;
      notify(saved.analysis.status === 'unavailable' ? 'Report saved. AI is unavailable; attribute matching is available.' : 'Report saved. Review the extracted attributes and matches.');
      navigate(`/reports/${saved.id}`);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('Delete this report and its images? Reports with active claims or recovery history cannot be deleted.')) return;
    setBusy(true); setError('');
    try { await api.delete(`/reports/${id}`, { data: {} }); notify('Report deleted.'); navigate('/my-reports'); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <section className="container page-section"><Link className="text-link" to="/my-reports">← My reports</Link><PageHead eyebrow="A PHOTO. A PLACE. A STARTING POINT." title={id ? 'Keep the details clear.' : 'Let’s help it find its way.'}>{id ? 'Update your report. Changes refresh the AI attributes and similarity suggestions.' : 'Tell us about the item. Keep identifying secrets for a private ownership claim.'}</PageHead>
    <div className="editor-layout"><form key={report?.revision || 'new'} className="panel report-form" onSubmit={submit}>{error && <ErrorNotice>{error}</ErrorNotice>}{locked && <ErrorNotice>This report is {report.status} and is locked to preserve recovery history.</ErrorNotice>}{report?.moderation === 'hidden' && <Badge tone="warning">Hidden from public browsing by an administrator</Badge>}
      <fieldset disabled={busy || locked}>
        {!id && <Select id="report-type" name="type" label="What would you like to report?" defaultValue="lost"><option value="lost">I lost something</option><option value="found">I found something</option></Select>}
        <Field id="title" name="title" label="Item name" required minLength={3} maxLength={120} defaultValue={report?.title} placeholder="e.g. Green canvas backpack" />
        <TextArea id="description" name="description" label="Description" required minLength={10} maxLength={3000} rows={5} defaultValue={report?.description} placeholder="Describe the item’s appearance and where it was last seen." hint="Publicly visible. Do not include passwords, serial numbers, addresses or private ownership evidence." />
        <div className="form-grid"><Select id="category" name="category" label="Category" defaultValue={report?.category || 'other'}>{categories.map((c) => <option key={c}>{c}</option>)}</Select><Field id="colour" name="colour" label="Colour" maxLength={80} defaultValue={report?.colour} placeholder="e.g. Forest green" /></div>
        <Field id="location" name="location" label="Location or landmark" required minLength={2} maxLength={200} defaultValue={report?.location} placeholder="e.g. Central library, entrance" />
        <Field id="occurredAt" name="occurredAt" label={report?.type === 'found' ? 'Date found' : 'Date lost or found'} required type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={report?.occurredAt?.slice(0, 10)} />
        <div className="upload-zone"><ImagePlus size={26} /><Field id="images" name="images" label={id ? 'Replace photographs (optional)' : 'Item photographs (optional)'} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { const selected = [...e.target.files]; if (selected.length > 3 || selected.some((f) => f.size > 5 * 1024 * 1024)) { setError('Choose up to three photographs, each under 5 MB.'); e.target.value = ''; setFiles([]); } else { setError(''); setFiles(selected); } }} hint="Up to 3 JPEG, PNG or WebP images, 5 MB each. Photographs are public and sent to Gemini when configured. Avoid faces and identifying documents." />
          <div className="image-previews">{(previews.length ? previews : report?.images?.map((i) => i.url) || []).map((url, i) => <img key={url} src={url} alt={`Item photograph ${i + 1}`} />)}</div></div>
        {id && <><label className="checkbox-label"><input type="checkbox" name="clearImages" value="true" /> Remove existing photographs (if no replacement selected)</label><Select id="status" name="status" label="Report status" defaultValue={report?.status}><option value="open">Open to matches</option><option value="closed">Closed</option></Select></>}
        <div className="form-actions"><Button type="submit" loading={busy}>{id ? 'Save changes' : 'Publish report'}</Button><Link to={id ? `/reports/${id}` : '/reports'} className="text-link">Cancel</Link></div>
      </fieldset>{id && !locked && <Button variant="ghost" type="button" disabled={busy} onClick={remove}>Delete report</Button>}
    </form><aside className="editor-aside"><div className="panel"><Sparkles size={25} /><h2>A little help with the details</h2><p>Gemini can identify visible attributes, improve the description and compare similar reports. Review its suggestions; you know your item best.</p><p>If AI is unavailable, your report remains searchable and matches use item attributes.</p></div><div className="panel"><ShieldCheck size={25} /><h2>Keep proof private</h2><p>Share only general details here. Hidden markings or purchase information belong in a private claim, visible only to you and administrators.</p></div></aside></div>
  </section>;
}
