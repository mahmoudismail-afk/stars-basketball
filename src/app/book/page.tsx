'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

/* ─── Types ──────────────────────────────────────────── */
interface Court { id: string; name: string; type: string; }
interface Booking {
  id: string; court_id: string; player_name: string; player_phone: string;
  date: string; start_time: string; end_time: string; duration: number; status: string;
}

/* ─── Constants ──────────────────────────────────────── */
const DURATIONS = [60, 90, 120];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

/* ─── Generate 30-min blocks 06:00→23:00 ─────────────── */
function generate30MinBlocks() {
  const blocks: { time: string; minutes: number }[] = [];
  for (let m = 6 * 60; m < 23 * 60; m += 30) {
    blocks.push({
      time: `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`,
      minutes: m,
    });
  }
  return blocks;
}
const ALL_BLOCKS = generate30MinBlocks();

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minutesToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
}
function formatTime12h(time24: string) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate(); }
function firstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }

/* ─── Block Status ───────────────────────────────────── */
//  'available' – free, can be selected
//  'booked'    – covered by an existing reservation (cannot select)
//  'conflict'  – free block but selecting it would overlap a booking (cannot select)
//  'selected'  – part of the user's current hover/selection range
//  'selected-conflict' – hover range collides with a booking (shows warning)
type BlockStatus = 'available' | 'booked' | 'conflict' | 'selected' | 'selected-conflict';

/** Check whether a range starting at `startIdx` with `slots` blocks overlaps any booking */
function rangeOverlapsBooking(startIdx: number, slots: number, bookings: Booking[]) {
  for (let i = startIdx; i < startIdx + slots && i < ALL_BLOCKS.length; i++) {
    const bMin = ALL_BLOCKS[i].minutes;
    const bEnd = bMin + 30;
    if (bookings.some(bk => {
      const bkS = timeToMinutes(bk.start_time);
      const bkE = timeToMinutes(bk.end_time);
      return bMin < bkE && bEnd > bkS;
    })) return true;
  }
  return false;
}

/** Is a single block covered by any booking? */
function blockIsBooked(idx: number, bookings: Booking[]) {
  const bMin = ALL_BLOCKS[idx].minutes;
  const bEnd = bMin + 30;
  return bookings.some(bk => {
    const bkS = timeToMinutes(bk.start_time);
    const bkE = timeToMinutes(bk.end_time);
    return bMin < bkE && bEnd > bkS;
  });
}

function getBlockStatuses(
  bookings: Booking[],
  hoveredIdx: number | null,
  selectedStartIdx: number | null,
  duration: number,
): BlockStatus[] {
  const slots = duration / 30;

  return ALL_BLOCKS.map((_, idx) => {
    // 1. Is this block covered by an existing booking?
    if (blockIsBooked(idx, bookings)) return 'booked';

    // 2. Hover preview takes priority over confirmed selection
    if (hoveredIdx !== null) {
      const inHoverRange = idx >= hoveredIdx && idx < hoveredIdx + slots;
      if (inHoverRange) {
        // Does the hover range collide with a booking?
        if (rangeOverlapsBooking(hoveredIdx, slots, bookings)) {
          return 'selected-conflict';
        }
        return 'selected';
      }
      // Not in hover range – mark blocks that can't be validly started here
      if (rangeOverlapsBooking(idx, slots, bookings) || idx + slots > ALL_BLOCKS.length) {
        return 'conflict';
      }
      return 'available';
    }

    // 3. Confirmed selection (no hover active)
    if (selectedStartIdx !== null) {
      if (idx >= selectedStartIdx && idx < selectedStartIdx + slots) return 'selected';
    }

    // 4. Is this block a valid start? (range fits & doesn't overlap bookings)
    if (idx + slots > ALL_BLOCKS.length || rangeOverlapsBooking(idx, slots, bookings)) {
      return 'conflict';
    }

    return 'available';
  });
}

/* ─── Step Indicator ─────────────────────────────────── */
function StepIndicator({ step }: { step: 'calendar' | 'form' | 'success' }) {
  const steps = ['Date & Time', 'Details', 'Confirmed'];
  const idx = step === 'calendar' ? 0 : step === 'form' ? 1 : 2;
  return (
    <div className="step-indicator">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`step-dot ${i < idx ? 'done' : i === idx ? 'active' : ''}`}>
            {i < idx ? '✓' : i + 1}
          </div>
          {i < steps.length - 1 && <div className={`step-line ${i < idx ? 'done' : ''}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────── */
export default function BookingPage() {
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedStartIdx, setSelectedStartIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedCourt, setSelectedCourt] = useState('court-1');
  const [duration, setDuration] = useState(90);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [step, setStep] = useState<'calendar' | 'form' | 'success'>('calendar');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<Booking | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const slotsNeeded = duration / 30;
  const court = courts.find(c => c.id === selectedCourt);
  const selectedStartTime = selectedStartIdx !== null ? ALL_BLOCKS[selectedStartIdx]?.time : null;
  const selectedEndTime   = selectedStartIdx !== null ? minutesToTime(ALL_BLOCKS[selectedStartIdx].minutes + duration) : null;

  /* Block statuses – recomputed on every relevant state change */
  const blockStatuses = getBlockStatuses(bookings, hoveredIdx, selectedStartIdx, duration);

  /* Load courts */
  useEffect(() => {
    fetch('/api/courts').then(r => r.json()).then((data: any) => {
      setCourts(data);
      if (data.length > 0) setSelectedCourt(data[0].id);
    }).catch(() => {});
  }, []);

  /* Load bookings */
  const fetchBookings = useCallback(async (date: Date, courtId: string) => {
    try {
      const res = await fetch(`/api/bookings?date=${fmtDate(date)}&courtId=${courtId}`, { cache: 'no-store' });
      const data = (await res.json()) as any;
      setBookings(Array.isArray(data) ? data : []);
    } catch { setBookings([]); }
  }, []);

  useEffect(() => {
    if (selectedDate) fetchBookings(selectedDate, selectedCourt);
  }, [selectedDate, selectedCourt, fetchBookings]);

  /* Calendar */
  const handleDateSelect = (day: number) => {
    const date = new Date(calYear, calMonth, day);
    if (date < todayMid) return;
    setSelectedDate(date);
    setSelectedStartIdx(null);
    setHoveredIdx(null);
    setTimeout(() => timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const prevMonth = () => calMonth === 0 ? (setCalMonth(11), setCalYear(y => y-1)) : setCalMonth(m => m-1);
  const nextMonth = () => calMonth === 11 ? (setCalMonth(0), setCalYear(y => y+1)) : setCalMonth(m => m+1);

  /* Block interaction */
  const handleBlockClick = (idx: number) => {
    const status = blockStatuses[idx];
    if (status === 'booked' || status === 'conflict' || status === 'selected-conflict') return;
    setSelectedStartIdx(selectedStartIdx === idx ? null : idx);
    setHoveredIdx(null);
  };

  const handleBlockHover = (idx: number | null) => setHoveredIdx(idx);

  /* Confirm booking */
  const handleConfirm = async () => {
    if (!selectedDate || selectedStartIdx === null || !form.name || !form.phone) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtId: selectedCourt, playerName: form.name, playerPhone: form.phone,
          date: fmtDate(selectedDate), startTime: selectedStartTime, endTime: selectedEndTime, duration,
        }),
      });
      const data = (await res.json()) as any;

      // ── Slot was taken by someone else (race condition) ──────────────────
      if (res.status === 409) {
        // Refresh timeline so the newly-booked blocks turn red immediately
        await fetchBookings(selectedDate, selectedCourt);
        // Clear the user's selection — they must pick a new slot
        setSelectedStartIdx(null);
        setStep('calendar');
        setError(data.error || 'This slot was just taken. Please choose another time.');
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Booking failed');
      setSuccessBooking(data.booking);
      setStep('success');
      await fetchBookings(selectedDate, selectedCourt);
      setSelectedStartIdx(null);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };


  const reset = () => {
    setStep('calendar'); setSelectedStartIdx(null); setHoveredIdx(null);
    setForm({ name: '', phone: '' }); setError(null); setSuccessBooking(null);
  };

  const dim = daysInMonth(calYear, calMonth);
  const firstDay = firstDayOfMonth(calYear, calMonth);

  /* ─── Legend data ─────────────────────────────────── */
  const legend = [
    { color: 'var(--surface-hover)',           border: 'var(--border-color)',              label: 'Available' },
    { color: 'rgba(0,243,255,0.22)',            border: 'rgba(0,243,255,0.6)',              label: 'Your selection' },
    { color: 'rgba(255,55,75,0.2)',             border: 'rgba(255,55,75,0.5)',              label: 'Reserved' },
    { color: 'rgba(255,140,0,0.15)',            border: 'rgba(255,140,0,0.45)',             label: 'Blocked by reservation' },
  ];

  /* ─── Render ──────────────────────────────────────── */
  return (
    <main style={{ paddingTop: 'calc(var(--nav-height) + 0.75rem)', minHeight: '100svh', background: 'var(--background)' }}>

      {/* Nav */}
      <nav className="navbar">
        <div style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
          Arena<span style={{ color: 'var(--neon-green)' }}>Padel</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ThemeToggle />
          <Link href="/" className="btn-neon" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', minHeight: '36px' }}>
            Home
          </Link>
        </div>
      </nav>

      <div className={`container ${step === 'calendar' && selectedDate && selectedStartIdx !== null ? 'has-bottom-cta' : step === 'form' ? 'has-bottom-cta' : ''}`}
        style={{ paddingBottom: step === 'success' ? '2rem' : undefined }}>

        {/* Header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <StepIndicator step={step} />
          <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.5rem)', lineHeight: 1.15 }}>
            {step === 'calendar' ? <><span className="text-gradient">Book</span> a Court</> :
             step === 'form'     ? <>Your <span className="text-gradient">Details</span></> :
             <><span className="text-gradient">Confirmed!</span> 🎾</>}
          </h1>
          {step === 'calendar' && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Pick a date, hover to preview a slot, click to confirm
            </p>
          )}

          {/* Race-condition / slot-taken error banner */}
          {step === 'calendar' && error && (
            <div className="animate-in" style={{
              marginTop: '0.75rem',
              background: 'rgba(255,60,60,0.08)',
              border: '1px solid rgba(255,80,80,0.35)',
              borderLeft: '3px solid #ff4050',
              borderRadius: 'var(--border-radius-sm)',
              padding: '0.75rem 1rem',
              color: '#ff7070',
              fontSize: '0.875rem',
              display: 'flex', alignItems: 'center', gap: '0.6rem',
            }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚡</span>
              <span>{error} <strong style={{ color: '#ff9090' }}>Please pick a new slot below.</strong></span>
            </div>
          )}
        </div>

        {/* ─── SUCCESS ─── */}
        {step === 'success' && successBooking && (
          <div className="animate-in" style={{ maxWidth: '520px', margin: '0 auto' }}>
            <div className="glass-card" style={{ borderTop: '3px solid var(--neon-green)' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
                <h2 style={{ fontSize: '1.4rem', color: 'var(--neon-green)' }}>Booking Confirmed</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>See you on the court!</p>
              </div>
              <div style={{ background: 'rgba(57,255,20,0.04)', border: '1px solid rgba(57,255,20,0.15)', borderRadius: 'var(--border-radius-sm)', padding: '1rem', marginBottom: '1.25rem' }}>
                {[
                  ['Player', successBooking.player_name],
                  ['Phone',  successBooking.player_phone],
                  ['Court',  court?.name ?? successBooking.court_id],
                  ['Date',   successBooking.date],
                  ['Time',   `${formatTime12h(successBooking.start_time)} – ${formatTime12h(successBooking.end_time)}`],
                  ['Duration', `${successBooking.duration} min`],
                ].map(([k, v]) => (
                  <div key={k} className="success-row">
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
                    <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
              <button className="btn-neon pulse-green" style={{ width: '100%', padding: '1rem' }} onClick={reset}>
                + Book Another Slot
              </button>
            </div>
          </div>
        )}

        {/* ─── FORM ─── */}
        {step === 'form' && selectedDate && selectedStartIdx !== null && (
          <div className="animate-in book-layout">
            <div className="glass-card">
              <h2 style={{ fontSize: '1rem', color: 'var(--neon-blue)', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Your Details
              </h2>
              {error && (
                <div style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,80,80,0.25)', borderRadius: 'var(--border-radius-sm)', padding: '0.85rem 1rem', marginBottom: '1.25rem', color: '#ff7070', fontSize: '0.875rem' }}>
                  ⚠ {error}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Full Name *
                  </label>
                  <input id="player-name" className="input-dark" placeholder="Your full name" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    style={{ width: '100%' }} autoComplete="name" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Phone Number *
                  </label>
                  <input id="player-phone" type="tel" className="input-dark" placeholder="Your phone number" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    style={{ width: '100%' }} autoComplete="tel" inputMode="tel" />
                </div>
              </div>
            </div>

            {/* Summary aside */}
            <div className="glass-card desktop-summary" style={{ borderTop: '2px solid var(--neon-blue)', position: 'sticky', top: 'calc(var(--nav-height) + 0.75rem)', alignSelf: 'start' }}>
              <h3 style={{ color: 'var(--neon-blue)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Your Selection</h3>
              {[
                ['Court',    court?.name ?? '—'],
                ['Date',     selectedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })],
                ['Time',     `${formatTime12h(selectedStartTime || '')} – ${formatTime12h(selectedEndTime || '')}`],
                ['Duration', `${duration} min`],
              ].map(([k, v]) => (
                <div key={k} className="success-row">
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{k}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{v}</span>
                </div>
              ))}
              <div className="desktop-only-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button id="confirm-booking-btn-desktop" className="btn-neon-blue"
                  style={{ width: '100%', padding: '0.9rem', opacity: loading ? 0.6 : 1, fontSize: '0.9rem' }}
                  onClick={handleConfirm}
                  disabled={loading || !form.name || !form.phone}>
                  {loading ? 'Booking…' : '✓ Confirm Booking'}
                </button>
                <button className="btn-neon" style={{ width: '100%', padding: '0.75rem', fontSize: '0.85rem' }}
                  onClick={() => setStep('calendar')}>
                  ← Back to Calendar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── CALENDAR + TIMELINE ─── */}
        {step === 'calendar' && (
          <div className="animate-in book-layout">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Court + Duration */}
              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Court
                    </label>
                    <select id="court-select" className="input-dark" value={selectedCourt}
                      onChange={e => { setSelectedCourt(e.target.value); setSelectedStartIdx(null); }}>
                      {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Duration
                    </label>
                    <div className="duration-tabs">
                      {DURATIONS.map(d => (
                        <button key={d} id={`dur-${d}`} className={`duration-tab ${d === duration ? 'active' : ''}`}
                          onClick={() => { setDuration(d); setSelectedStartIdx(null); }}>
                          {d}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Calendar */}
              <div className="glass-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <button id="prev-month-btn" onClick={prevMonth} aria-label="Previous month"
                    style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>‹</button>
                  <h3 style={{ fontFamily: 'var(--font-outfit)', fontSize: '1.05rem', letterSpacing: '0.02em' }}>
                    {MONTHS[calMonth]} {calYear}
                  </h3>
                  <button id="next-month-btn" onClick={nextMonth} aria-label="Next month"
                    style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>›</button>
                </div>
                <div className="cal-grid" style={{ marginBottom: '4px' }}>
                  {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', padding: '4px 0', fontWeight: 700 }}>{d}</div>)}
                </div>
                <div className="cal-grid">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: dim }).map((_, i) => {
                    const day = i + 1;
                    const cellDate = new Date(calYear, calMonth, day);
                    const isPast = cellDate < todayMid;
                    const isToday = cellDate.toDateString() === todayMid.toDateString();
                    const isSelected = selectedDate?.toDateString() === cellDate.toDateString();
                    return (
                      <button key={day} id={`cal-day-${day}`}
                        className={`cal-day-btn ${isPast ? 'past' : ''} ${isToday && !isSelected ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => !isPast && handleDateSelect(day)}
                        aria-label={`${MONTHS[calMonth]} ${day}`} aria-pressed={isSelected}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─── TIMELINE ─── */}
              {selectedDate && (
                <div className="glass-card animate-in" ref={timelineRef}>
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ color: 'var(--neon-green)', fontSize: '1rem', marginBottom: '4px' }}>
                      {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      Tap a slot to select · {duration}min = {slotsNeeded} block{slotsNeeded > 1 ? 's' : ''}
                    </p>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: '0.5rem 1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      {legend.map(({ color, border, label }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: 12, height: 12, borderRadius: 3, background: color, border: `1px solid ${border}`, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Blocks — 2-column grid, always-visible time label */}
                  <div className="timeline-grid" onMouseLeave={() => setHoveredIdx(null)}>
                    {ALL_BLOCKS.map((block, idx) => {
                      const status     = blockStatuses[idx];
                      const isHourMark = block.minutes % 60 === 0;

                      const isSelStart = selectedStartIdx !== null && hoveredIdx === null && idx === selectedStartIdx;
                      const isSelEnd   = selectedStartIdx !== null && hoveredIdx === null && idx === selectedStartIdx + slotsNeeded - 1;
                      const isHovStart = hoveredIdx !== null && idx === hoveredIdx;
                      const isHovEnd   = hoveredIdx !== null && idx === hoveredIdx + slotsNeeded - 1;

                      const isBad   = status === 'booked' || status === 'conflict' || status === 'selected-conflict';
                      const cursor  = isBad ? 'not-allowed' : 'pointer';

                      // Accent color for selected/hover labels
                      const accentColor =
                        status === 'selected-conflict' ? '#ff8c00'
                        : (isSelStart || isHovStart || isSelEnd || isHovEnd) ? 'var(--neon-blue)'
                        : undefined;

                      return (
                        <div
                          key={block.time}
                          id={`block-${block.time}`}
                          className={`timeline-block ${status} ${isHourMark ? 'hour-mark' : ''}`}
                          style={{ cursor }}
                          onClick={() => handleBlockClick(idx)}
                          onMouseEnter={() => handleBlockHover(idx)}
                          role="button"
                          tabIndex={isBad ? -1 : 0}
                          aria-label={`${block.time} – ${status}`}
                          aria-disabled={isBad}
                        >
                          {/* Always-visible time pill on the left */}
                          <span className="block-time-label" style={{ color: accentColor, fontWeight: (isSelStart || isHovStart) ? 700 : undefined }}>
                            {formatTime12h(block.time)}
                          </span>

                          {/* Separator line in the middle */}
                          <span className="block-divider" />

                          {/* Right side: end-time on last block of range, or status icon */}
                          <span className="block-right">
                            {(isSelEnd || isHovEnd)
                              ? <span className="block-end-time" style={{ color: accentColor }}>→ {formatTime12h(minutesToTime(block.minutes + 30))}</span>
                              : status === 'booked'
                                ? <span className="block-status-icon" style={{ color: 'rgba(255,80,100,0.85)' }}>Reserved ✕</span>
                                : status === 'conflict'
                                  ? <span className="block-status-icon" style={{ color: 'rgba(255,140,0,0.8)' }}>Blocked ⊘</span>
                                  : status === 'selected-conflict'
                                    ? <span className="block-status-icon" style={{ color: '#ff8c00' }}>⚠ Conflict</span>
                                    : <span className="block-status-icon" style={{ color: 'var(--neon-blue)', opacity: 0.8 }}>Available</span>
                            }
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selection summary */}
                  {selectedStartIdx !== null && (
                    <div className="animate-in" style={{
                      marginTop: '1rem', padding: '0.75rem 1rem',
                      background: 'rgba(0,243,255,0.06)', border: '1px solid rgba(0,243,255,0.25)',
                      borderRadius: 'var(--border-radius-sm)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Selected Slot</span>
                        <span style={{ fontWeight: 700, color: 'var(--neon-blue)', fontSize: '1.05rem' }}>
                          {formatTime12h(selectedStartTime || '')} → {formatTime12h(selectedEndTime || '')}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Duration</span>
                        <span style={{ fontWeight: 600 }}>{duration} min</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!selectedDate && (
                <div className="glass-card" style={{ textAlign: 'center', padding: '2rem 1rem', opacity: 0.55 }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Select a date to view the court timeline</p>
                </div>
              )}
            </div>

            {/* Desktop sidebar */}
            <div className="glass-card desktop-summary" style={{ position: 'sticky', top: 'calc(var(--nav-height) + 0.75rem)', borderTop: '2px solid var(--neon-blue)', alignSelf: 'start' }}>
              <h3 style={{ color: 'var(--neon-blue)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem' }}>Summary</h3>
              {[
                ['Court',    court?.name ?? '—'],
                ['Type',     court ? (court.type === 'indoor' ? '🏟 Indoor' : '☀️ Outdoor') : '—'],
                ['Date',     selectedDate ? selectedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'],
                ['Time',     selectedStartTime && selectedEndTime ? `${formatTime12h(selectedStartTime)} – ${formatTime12h(selectedEndTime)}` : '—'],
                ['Duration', `${duration} min`],
              ].map(([k, v]) => (
                <div key={k} className="success-row">
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{k}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{v}</span>
                </div>
              ))}
              {selectedStartIdx !== null && selectedDate && (
                <button id="proceed-btn-desktop" className="btn-neon-blue" style={{ width: '100%', padding: '0.9rem', marginTop: '1.25rem' }}
                  onClick={() => setStep('form')}>
                  Continue →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── STICKY BOTTOM CTA ─── */}
      {step === 'calendar' && selectedDate && selectedStartIdx !== null && (
        <div className="bottom-cta animate-in">
          <div className="mini-summary">
            <div className="mini-summary-item">
              <span className="mini-label">Date</span>
              <span className="mini-value">{selectedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </div>
            <div style={{ width: 1, height: 28, background: 'var(--border-color)', flexShrink: 0 }} />
            <div className="mini-summary-item">
              <span className="mini-label">Slot</span>
              <span className="mini-value">{formatTime12h(selectedStartTime || '')} → {formatTime12h(selectedEndTime || '')}</span>
            </div>
            <div style={{ width: 1, height: 28, background: 'var(--border-color)', flexShrink: 0 }} />
            <div className="mini-summary-item">
              <span className="mini-label">Court</span>
              <span className="mini-value">{court?.name?.replace(' Court','') ?? '—'}</span>
            </div>
          </div>
          <button id="proceed-btn" className="btn-neon-blue"
            style={{ flexShrink: 0, padding: '0.75rem 1.25rem', fontSize: '0.9rem' }}
            onClick={() => setStep('form')}>
            Next →
          </button>
        </div>
      )}

      {step === 'form' && selectedDate && selectedStartIdx !== null && (
        <div className="bottom-cta animate-in">
          <button className="btn-neon" style={{ flex: 1, padding: '0.75rem' }}
            onClick={() => setStep('calendar')}>← Back</button>
          <button id="confirm-booking-btn" className="btn-neon-blue"
            style={{ flex: 2, padding: '0.75rem', opacity: loading ? 0.6 : 1, fontSize: '0.9rem' }}
            onClick={handleConfirm}
            disabled={loading || !form.name || !form.phone}>
            {loading ? 'Booking…' : '✓ Confirm Booking'}
          </button>
        </div>
      )}
    </main>
  );
}
