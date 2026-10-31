import { ArrowDown, ArrowRight, Check, Fingerprint, HeartHandshake, ImagePlus, MapPin, Search, ShieldCheck, Sparkles, Tag } from 'lucide-react';
import { ButtonLink } from '../components/ui';

function RecoveryIllustration() {
  return <div className="recovery-illustration" aria-label="Illustration of a lost bag reconnecting with its owner">
    <div className="illustration-grid" />
    <div className="orbit orbit-one" /><div className="orbit orbit-two" />
    <div className="illustration-topline"><span className="tiny-dot" /> A connection worth making <span className="visual-cross">+</span></div>
    <div className="floating-label location-label"><MapPin size={15} /><span>Somewhere nearby</span></div>
    <div className="bag-frame">
      <svg viewBox="0 0 280 280" role="img" aria-label="A green everyday backpack" className="backpack">
        <ellipse cx="142" cy="251" rx="82" ry="12" fill="#173b2c" opacity=".1" />
        <path d="M109 61V45c0-25 59-25 59 0v17" fill="none" stroke="#274638" strokeWidth="12" />
        <path d="M89 84C54 105 50 180 64 222M189 83c35 24 38 101 25 139" fill="none" stroke="#274638" strokeWidth="16" />
        <path d="M81 64Q139 34 197 66L213 224q1 24-25 25H91q-28 0-27-25Z" fill="#385e48" />
        <path d="M81 66q58-30 116 0l4 52q-64 27-126 0Z" fill="#4c775c" />
        <path d="M83 119q58 20 116-1" fill="none" stroke="#83a17f" strokeWidth="2" />
        <rect x="91" y="159" width="94" height="67" rx="15" fill="#456c52" stroke="#284b38" strokeWidth="2" />
        <path d="M102 172h72" stroke="#b5ba8c" strokeWidth="3" strokeLinecap="round" />
        <path d="M168 173v10" stroke="#dfd8b9" strokeWidth="4" strokeLinecap="round" />
        <rect x="125" y="91" width="28" height="21" rx="3" fill="#e3cba7" />
        <path d="m132 104 7-6 7 6" fill="none" stroke="#766b50" strokeWidth="2" />
        <path d="M80 132v81M196 132v81" stroke="#7b9a78" strokeWidth="2" opacity=".5" />
        <path d="m202 111 26 12-13 33-26-12Z" fill="#f4d7a6" transform="rotate(-9 210 130)" />
        <circle cx="211" cy="119" r="3" fill="#947d59" /><path d="M211 119q-17-30-16-4" stroke="#c4b89c" fill="none" strokeWidth="2" />
      </svg>
      <span className="scan-corner top-left" /><span className="scan-corner top-right" /><span className="scan-corner bottom-left" /><span className="scan-corner bottom-right" />
    </div>
    <div className="floating-label item-label"><span className="mini-icon"><Tag size={17} /></span><div><small>MORE THAN AN OBJECT</small><strong>Your everyday companion</strong></div></div>
    <div className="connection-pill"><span><Check size={14} /></span>Every detail brings us closer</div>
    <div className="illustration-caption"><span>LOST</span><div /><HeartHandshake size={19} /><div /><span>BACK HOME</span></div>
  </div>;
}

export default function HomePage() {
  return <>
    <section className="hero container">
      <div className="hero-copy">
        <div className="eyebrow"><span className="tiny-dot" /> SMALL CONNECTIONS. MEANINGFUL RETURNS.</div>
        <h1>A little lost.<br />Not gone <span className="hero-emphasis">forever.<svg viewBox="0 0 260 18" aria-hidden="true"><path d="M4 11Q115-3 254 8M37 16q109-9 198-2" /></svg></span></h1>
        <p className="hero-description">Your belongings have a story. Let’s bring them back to you. A thoughtful new home for lost & found, with a little help from AI.</p>
        <div className="hero-actions"><ButtonLink to="/reports/new" arrow>Report an item</ButtonLink><ButtonLink to="/reports" variant="outline">Browse items <Search size={16} /></ButtonLink></div>
        <div className="hero-note"><ShieldCheck size={17} /><span>Private by design. People at the heart.</span></div>
        <div className="release-note"><span className="release-badge">INTELLIGENT RECOVERY</span><p>Report a loss. Spot a connection. Bring something home.</p></div>
      </div>
      <RecoveryIllustration />
    </section>

    <div className="principles-strip"><div className="container principles-inner"><span>A better way back.</span><div><Search size={18} /> Less searching in circles</div><div><Sparkles size={18} /> More meaningful connections</div><div><HeartHandshake size={18} /> A community that cares</div></div></div>

    <section className="container process-section" id="how-it-works">
      <div className="section-heading"><div><p className="eyebrow">THE RECOVERY JOURNEY</p><h2>From “where is it?”<br />to “there it is.”</h2></div><p>A simple path from a missing item to a careful reunion. Every step keeps you informed and in control.</p></div>
      <div className="process-grid">
        <article className="process-card"><div className="process-card-top"><span className="icon-tile peach"><ImagePlus size={24} /></span><span className="step-number">01</span></div><h3>Tell your side of the story</h3><p>Lost something or found something? Add a photo, a few details, and where it was last seen.</p><div className="process-foot">A photo. A place. A starting point.</div></article>
        <article className="process-card"><div className="process-card-top"><span className="icon-tile sage"><Sparkles size={24} /></span><span className="step-number">02</span></div><h3>Let the details connect</h3><p>Gemini helps understand the image and suggest similar reports, even when people use different words.</p><div className="process-foot">Intelligent similarity, explained.</div></article>
        <article className="process-card"><div className="process-card-top"><span className="icon-tile lilac"><HeartHandshake size={24} /></span><span className="step-number">03</span></div><h3>Make a careful handover</h3><p>Share private ownership evidence for a human review, then record the return of the item.</p><div className="process-foot">A real person. A considered decision.</div></article>
      </div>
    </section>

    <section className="container trust-section" id="responsible-ai"><div className="trust-art" aria-hidden="true"><div className="fingerprint-ring"><Fingerprint size={94} strokeWidth={1} /></div><span className="trust-art-tag"><ShieldCheck size={16} /> Trust comes first</span><div className="trust-art-caption">YOUR DETAILS.<br />YOUR STORY.</div></div><div className="trust-copy"><p className="eyebrow">SMART TECHNOLOGY. HUMAN JUDGMENT.</p><h2>A possible match.<br />Never an assumption.</h2><p>A familiar colour or a similar photo can start a conversation. It can’t prove who owns an item. That’s why our recovery design keeps people in control.</p><ul className="trust-list"><li><Check size={17} /> Similarity scores never mean proof of ownership.</li><li><Check size={17} /> Private claim evidence stays out of public reports.</li><li><Check size={17} /> Administrators, never AI, review ownership claims.</li></ul></div></section>

    <section className="container closing-section"><div><span className="eyebrow">SOMETHING GOOD STARTS WITH YOU</span><h2>Be part of the way back.</h2><p>Join a more connected lost & found. A small action can make someone’s day.</p></div><ButtonLink to="/register" variant="light">Join ClaimBack <ArrowRight size={18} /></ButtonLink></section>
  </>;
}
