'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Booking {
  id: string; court_id: string; player_name: string; player_phone: string;
  date: string; start_time: string; end_time: string; duration: number; status: string;
  created_at: number;
}

function formatTime12h(time24: string) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history' | 'cancelled'>('upcoming');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load password from session storage on mount
  useEffect(() => {
    fetch('/api/courts').then(r => r.json()).then((data: any) => setCourts(data)).catch(() => {});
    
    const saved = sessionStorage.getItem('admin_token');
    if (saved) {
      setPassword(saved);
      fetchBookings(saved);
    }
  }, []);

  const fetchBookings = async (token: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin', {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await res.json() as any;
      if (res.status === 401) {
        setIsAuthenticated(false);
        sessionStorage.removeItem('admin_token');
        throw new Error('Incorrect password');
      }
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      
      setBookings(data);
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_token', token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBookings(password);
  };

  const handleCancelBooking = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) return;
    
    try {
      const res = await fetch(`/api/admin?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (!res.ok) throw new Error('Failed to cancel');
      
      // We don't remove from list, we just update status so it moves to cancelled tab
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    setPassword('');
    setBookings([]);
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div className="glass-card animate-in" style={{ maxWidth: '380px', width: '100%', padding: '2.5rem 2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
            <h1 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', margin: 0 }}>
              Admin <span className="text-gradient">Access</span>
            </h1>
          </div>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                Password
              </label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{
                  width: '100%',
                  background: 'var(--surface-light)',
                  border: '1px solid var(--border-color)',
                  color: 'white',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--neon-blue)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
              />
            </div>
            
            {error && (
              <div className="animate-in" style={{ 
                background: 'rgba(255,60,60,0.08)', borderLeft: '3px solid #ff4050',
                color: '#ff7070', fontSize: '0.85rem', padding: '0.75rem', borderRadius: '4px'
              }}>
                {error}
              </div>
            )}
            
            <button type="submit" className="btn-neon-blue" style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Verifying...' : 'Unlock Dashboard'}
            </button>
          </form>
          
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-block', padding: '0.5rem' }}>
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Helper to split bookings
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const isPast = (b: Booking) => {
    if (b.date < todayStr) return true;
    if (b.date === todayStr && b.end_time <= timeStr) return true;
    return false;
  };

  const filteredBookings = bookings.filter(b => {
    if (activeTab === 'upcoming') return b.status === 'confirmed' && !isPast(b);
    if (activeTab === 'history') return b.status === 'confirmed' && isPast(b);
    if (activeTab === 'cancelled') return b.status === 'cancelled';
    return false;
  });

  // Group by date
  const groupedBookings = filteredBookings.reduce((acc, b) => {
    if (!acc[b.date]) acc[b.date] = [];
    acc[b.date].push(b);
    return acc;
  }, {} as Record<string, Booking[]>);

  // For history/cancelled, we probably want descending order of dates
  const sortedDates = Object.keys(groupedBookings).sort((a, b) => activeTab !== 'upcoming' ? (a < b ? 1 : -1) : (a > b ? 1 : -1));

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', margin: 0 }}>
          Admin <span className="text-gradient">Dashboard</span>
        </h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => fetchBookings(password)} className="btn-neon" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Refresh</button>
          <button onClick={logout} className="btn-neon" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderColor: 'rgba(255,80,80,0.5)', color: '#ff7070' }}>Logout</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <button 
          onClick={() => setActiveTab('upcoming')} 
          style={{ 
            padding: '0.75rem 1rem', background: 'transparent', border: 'none', 
            color: activeTab === 'upcoming' ? 'var(--neon-blue)' : 'var(--text-muted)', 
            borderBottom: activeTab === 'upcoming' ? '2px solid var(--neon-blue)' : '2px solid transparent', 
            cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' 
          }}
        >
          Upcoming
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          style={{ 
            padding: '0.75rem 1rem', background: 'transparent', border: 'none', 
            color: activeTab === 'history' ? 'var(--neon-blue)' : 'var(--text-muted)', 
            borderBottom: activeTab === 'history' ? '2px solid var(--neon-blue)' : '2px solid transparent', 
            cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' 
          }}
        >
          History
        </button>
        <button 
          onClick={() => setActiveTab('cancelled')} 
          style={{ 
            padding: '0.75rem 1rem', background: 'transparent', border: 'none', 
            color: activeTab === 'cancelled' ? '#ff7070' : 'var(--text-muted)', 
            borderBottom: activeTab === 'cancelled' ? '2px solid #ff7070' : '2px solid transparent', 
            cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' 
          }}
        >
          Cancelled
        </button>
      </div>

      {sortedDates.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No {activeTab} reservations found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {sortedDates.map(dateStr => {
            const dayBookings = groupedBookings[dateStr];
            const dateObj = new Date(dateStr);
            const isToday = dateStr === todayStr;
            const dateTitle = isToday ? 'Today' : dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

            return (
              <div key={dateStr}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: isToday ? 'var(--neon-blue)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📅 {dateTitle}
                  <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-muted)' }}>
                    {dayBookings.length} bookings
                  </span>
                </h2>
                
                <div className="glass-card" style={{ padding: '0', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Time</th>
                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Court</th>
                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Player Details</th>
                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayBookings.map(b => (
                        <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: b.status === 'cancelled' ? 0.6 : 1 }}>
                          <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                            <span style={{ color: b.status === 'cancelled' ? 'var(--text-muted)' : 'var(--neon-blue)', fontWeight: 600 }}>
                              {formatTime12h(b.start_time)} - {formatTime12h(b.end_time)}
                            </span>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>({b.duration} mins)</div>
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            {courts.find(c => c.id === b.court_id)?.name || b.court_id}
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                            <div style={{ fontWeight: 600, textDecoration: b.status === 'cancelled' ? 'line-through' : 'none' }}>{b.player_name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{b.player_phone}</div>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            {b.status === 'cancelled' ? (
                              <span style={{ color: '#ff7070', fontSize: '0.85rem', fontWeight: 600 }}>Cancelled</span>
                            ) : b.date < todayStr ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Completed</span>
                            ) : (
                              <button 
                                onClick={() => handleCancelBooking(b.id)}
                                style={{ 
                                  background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', 
                                  color: '#ff7070', padding: '0.4rem 0.8rem', borderRadius: '4px', 
                                  fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,60,60,0.2)'}
                                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,60,60,0.1)'}
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
