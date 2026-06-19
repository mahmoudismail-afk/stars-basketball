'use client';
import React from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Home() {
  return (
    <main>
      {/* ─── Navigation ─── */}
      <nav className="navbar">
        <span className="text-gradient" style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
          ARENA PADEL
        </span>
        <div className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/book">Book a Court</Link>
          <Link href="#pricing">Pricing</Link>
          <Link href="#faq">FAQ</Link>
          <Link href="#contact">Contact</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ThemeToggle />
          <Link href="/book">
            <button id="nav-book-btn" className="btn-neon" style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem', minHeight: '40px' }}>
              Book Now
            </button>
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="hero">
        <div className="hero-content container">
          <p style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(0,243,255,0.08)', border: '1px solid rgba(0,243,255,0.2)', borderRadius: '9999px', padding: '0.3rem 0.75rem', fontSize: '0.78rem', color: 'var(--neon-blue)', fontWeight: 600, marginBottom: '1rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            🎾 Open 06:00 – 23:00 · Daily
          </p>
          <h1 style={{ fontSize: 'clamp(2.2rem, 8vw, 4.5rem)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Elevate Your Game<br />
            <span className="text-gradient">ARENA PADEL</span>
          </h1>
          <p style={{ fontSize: 'clamp(0.95rem, 3vw, 1.2rem)', color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '520px' }}>
            Premium courts, electric atmosphere, and a seamless booking experience — no membership required.
          </p>
          <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/book">
              <button id="hero-book-btn" className="btn-neon" style={{ padding: '0.9rem 2rem', fontSize: '1rem' }}>
                Reserve a Court
              </button>
            </Link>
          </div>
        </div>
        <div className="hero-bg" />
      </section>


      {/* ─── Pricing ─── */}
      <section id="pricing" className="container section-home" style={{ paddingTop: '1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', marginBottom: '0.4rem' }}>
            Simple <span className="text-gradient">Pricing</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No membership. No hidden fees.</p>
        </div>
        <div className="pricing-grid">
          {[
            { dur: '60 min', price: '$30', label: 'Quick Game' },
            { dur: '90 min', price: '$40', label: '⭐ Most Popular', highlight: true },
            { dur: '120 min', price: '$55', label: 'Best Value' },
          ].map(p => (
            <div key={p.dur} className="glass-card" style={{
              textAlign: 'center', padding: '1.5rem',
              borderTop: p.highlight ? '2px solid var(--neon-green)' : '2px solid var(--border-color)',
              transform: p.highlight ? 'scale(1.02)' : undefined,
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                {p.label}
              </p>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>{p.dur}</h3>
              <div className={p.highlight ? 'text-gradient' : ''} style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', color: p.highlight ? undefined : 'var(--text-primary)' }}>
                {p.price}
              </div>
              <Link href="/book">
                <button className={p.highlight ? 'btn-neon' : 'btn-neon-blue'} style={{ width: '100%', padding: '0.7rem', fontSize: '0.85rem' }}>
                  Book Now
                </button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="container section-home" style={{ paddingTop: '1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)' }}>
            Rules &amp; <span className="text-gradient">FAQ</span>
          </h2>
        </div>
        <div className="faq-grid">
          {[
            { q: 'What are the opening hours?', a: 'Every day from 06:00 to 23:00, including weekends and public holidays.' },
            { q: 'Do I need to register?', a: 'No account needed — just your name and phone number when booking.' },
            { q: 'Can I cancel?', a: 'Contact us via WhatsApp or phone and we\'ll handle it promptly.' },
          ].map(item => (
            <div key={item.q} className="glass-card" style={{ padding: '1.25rem' }}>
              <h4 style={{ marginBottom: '0.6rem', color: 'var(--neon-blue)', fontSize: '0.95rem' }}>{item.q}</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>



      {/* ─── Footer ─── */}
      <footer id="contact" style={{ borderTop: '1px solid var(--border-color)', padding: '2.5rem 0 1.5rem' }}>
        <div className="container">
          <div className="footer-inner">
            <div style={{ maxWidth: '280px' }}>
              <h3 className="text-gradient" style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>ARENA PADEL</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Where passion meets performance. Book your next game in seconds.
              </p>
            </div>
            <div className="footer-links">
              <div>
                <h4 style={{ marginBottom: '1rem', color: 'var(--neon-blue)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quick Links</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[['Book a Court', '/book'], ['Pricing', '#pricing'], ['FAQ', '#faq']].map(([label, href]) => (
                    <Link key={label} href={href} className="footer-link">{label}</Link>
                  ))}
                </div>
              </div>
              <div>
                <h4 style={{ marginBottom: '1rem', color: 'var(--neon-green)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contact</h4>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.4rem', fontSize: '0.875rem' }}>123 Smash Ave, Padel City</p>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>hello@arenapadel.com</p>
                <button className="btn-neon" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', minHeight: '38px' }}>
                  WhatsApp Us
                </button>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '2rem', paddingTop: '1rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              © {new Date().getFullYear()} Arena Padel · All rights reserved
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
