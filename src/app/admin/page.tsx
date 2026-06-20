'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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

function getPrice(duration: number) {
  if (duration <= 60) return 30;
  if (duration <= 90) return 40;
  if (duration <= 120) return 55;
  return Math.round((duration / 60) * 30);
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'charts' | 'yearly' | 'history' | 'cancelled'>('upcoming');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Chart states
  const [dailyChartType, setDailyChartType] = useState<'line' | 'bar' | 'area'>('line');
  const [monthlyChartType, setMonthlyChartType] = useState<'line' | 'bar' | 'area'>('bar');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [yearlyChartType, setYearlyChartType] = useState<'line' | 'bar' | 'area'>('bar');

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

  // ── Derived values – must be before any early return (Rules of Hooks) ──
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

  const groupedBookings = filteredBookings.reduce((acc, b) => {
    if (!acc[b.date]) acc[b.date] = [];
    acc[b.date].push(b);
    return acc;
  }, {} as Record<string, Booking[]>);

  const sortedDates = Object.keys(groupedBookings).sort((a, b) => activeTab !== 'upcoming' ? (a < b ? 1 : -1) : (a > b ? 1 : -1));

  const stats = useMemo(() => {
    const valid = bookings.filter(b => b.status === 'confirmed');
    const dailyMap: Record<string, any> = {};
    const monthlyMap: Record<string, any> = {};
    let totalRevenue = 0;
    let thisMonthRevenue = 0;
    let thisMonthBookings = 0;
    const currentMonth = todayStr.substring(0, 7);
    valid.forEach(b => {
      const p = getPrice(b.duration || 60);
      totalRevenue += p;
      const month = b.date.substring(0, 7);
      if (month === currentMonth) { thisMonthRevenue += p; thisMonthBookings += 1; }
      if (!dailyMap[b.date]) dailyMap[b.date] = { date: b.date, revenue: 0, bookings: 0 };
      dailyMap[b.date].revenue += p;
      dailyMap[b.date].bookings += 1;
      if (!monthlyMap[month]) monthlyMap[month] = { month, revenue: 0, bookings: 0 };
      monthlyMap[month].revenue += p;
      monthlyMap[month].bookings += 1;
    });
    const dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    const monthlyData = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
    return { dailyData, monthlyData, totalRevenue, thisMonthRevenue, thisMonthBookings };
  }, [bookings, todayStr]);

  const yearlyStats = useMemo(() => {
    const yearsSet = new Set<string>();
    yearsSet.add(now.getFullYear().toString()); // Ensure current year always available
    bookings.forEach(b => yearsSet.add(b.date.substring(0, 4)));
    const availableYears = Array.from(yearsSet).sort().reverse();
    
    const yearBookings = bookings.filter(b => b.date.startsWith(selectedYear));
    
    let totalConfirmed = 0;
    let totalCancelled = 0;
    let totalRevenue = 0;
    
    const monthlyMap: Record<string, { month: string; revenue: number; bookings: number; cancelled: number }> = {};
    for (let i = 1; i <= 12; i++) {
      const m = `${selectedYear}-${String(i).padStart(2, '0')}`;
      monthlyMap[m] = { month: m, revenue: 0, bookings: 0, cancelled: 0 };
    }

    yearBookings.forEach(b => {
      const month = b.date.substring(0, 7);
      if (!monthlyMap[month]) return;

      if (b.status === 'cancelled') {
        totalCancelled++;
        monthlyMap[month].cancelled += 1;
      } else if (b.status === 'confirmed') {
        totalConfirmed++;
        const p = getPrice(b.duration || 60);
        totalRevenue += p;
        monthlyMap[month].revenue += p;
        monthlyMap[month].bookings += 1;
      }
    });

    const monthlyData = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

    return { availableYears, totalConfirmed, totalCancelled, totalRevenue, monthlyData };
  }, [bookings, selectedYear, now]);

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
                  background: 'var(--surface)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
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

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', margin: 0 }}>
          Admin <span className="text-gradient">Dashboard</span>
        </h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ThemeToggle />
          <button onClick={() => fetchBookings(password)} className="btn-neon" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Refresh</button>
          <button onClick={logout} className="btn-neon" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderColor: 'rgba(255,80,80,0.5)', color: '#ff7070' }}>Logout</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', overflowX: 'auto' }}>
        <button 
          onClick={() => setActiveTab('upcoming')} 
          style={{ 
            padding: '0.75rem 1rem', background: 'transparent', border: 'none', 
            color: activeTab === 'upcoming' ? 'var(--neon-blue)' : 'var(--text-muted)', 
            borderBottom: activeTab === 'upcoming' ? '2px solid var(--neon-blue)' : '2px solid transparent', 
            cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap'
          }}
        >
          Upcoming
        </button>
        <button 
          onClick={() => setActiveTab('charts')} 
          style={{ 
            padding: '0.75rem 1rem', background: 'transparent', border: 'none', 
            color: activeTab === 'charts' ? 'var(--neon-blue)' : 'var(--text-muted)', 
            borderBottom: activeTab === 'charts' ? '2px solid var(--neon-blue)' : '2px solid transparent', 
            cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap'
          }}
        >
          Analytics
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          style={{ 
            padding: '0.75rem 1rem', background: 'transparent', border: 'none', 
            color: activeTab === 'history' ? 'var(--neon-blue)' : 'var(--text-muted)', 
            borderBottom: activeTab === 'history' ? '2px solid var(--neon-blue)' : '2px solid transparent', 
            cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap'
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
            cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap'
          }}
        >
          Cancelled
        </button>
        <button 
          onClick={() => setActiveTab('yearly')} 
          style={{ 
            padding: '0.75rem 1rem', background: 'transparent', border: 'none', 
            color: activeTab === 'yearly' ? 'var(--neon-blue)' : 'var(--text-muted)', 
            borderBottom: activeTab === 'yearly' ? '2px solid var(--neon-blue)' : '2px solid transparent', 
            cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap'
          }}
        >
          Yearly Report
        </button>
      </div>

      {activeTab === 'yearly' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Yearly Overview</h2>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(e.target.value)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border-color)', 
                color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '8px',
                fontSize: '1rem', outline: 'none', cursor: 'pointer'
              }}
            >
              {yearlyStats.availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Revenue</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--neon-green)', marginTop: '0.5rem' }}>${yearlyStats.totalRevenue}</div>
            </div>
            <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirmed Bookings</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--neon-blue)', marginTop: '0.5rem' }}>{yearlyStats.totalConfirmed}</div>
            </div>
            <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cancelled Bookings</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ff7070', marginTop: '0.5rem' }}>{yearlyStats.totalCancelled}</div>
            </div>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', margin: 0 }}>Monthly Breakdown ({selectedYear})</h3>
              <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <button onClick={() => setYearlyChartType('line')} style={{ padding: '0.25rem 0.75rem', background: yearlyChartType === 'line' ? 'var(--neon-blue)' : 'transparent', color: yearlyChartType === 'line' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Line</button>
                <button onClick={() => setYearlyChartType('bar')} style={{ padding: '0.25rem 0.75rem', background: yearlyChartType === 'bar' ? 'var(--neon-blue)' : 'transparent', color: yearlyChartType === 'bar' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Bar</button>
                <button onClick={() => setYearlyChartType('area')} style={{ padding: '0.25rem 0.75rem', background: yearlyChartType === 'area' ? 'var(--neon-blue)' : 'transparent', color: yearlyChartType === 'area' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Area</button>
              </div>
            </div>
            
            <div style={{ height: '300px', width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
              <div style={{ minWidth: '600px', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {yearlyChartType === 'line' ? (
                    <LineChart data={yearlyStats.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickFormatter={v => v.slice(5)} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border-color)', borderRadius: '8px' }} itemStyle={{ color: 'var(--neon-blue)', fontWeight: 600 }} />
                      <Line type="monotone" dataKey="revenue" stroke="var(--neon-blue)" strokeWidth={3} dot={{ r: 4, fill: 'var(--neon-blue)' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  ) : yearlyChartType === 'bar' ? (
                    <BarChart data={yearlyStats.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickFormatter={v => v.slice(5)} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border-color)', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} itemStyle={{ color: 'var(--neon-blue)', fontWeight: 600 }} />
                      <Bar dataKey="revenue" fill="var(--neon-blue)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <AreaChart data={yearlyStats.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickFormatter={v => v.slice(5)} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border-color)', borderRadius: '8px' }} itemStyle={{ color: 'var(--neon-blue)', fontWeight: 600 }} />
                      <Area type="monotone" dataKey="revenue" stroke="var(--neon-blue)" fill="var(--neon-blue)" fillOpacity={0.2} strokeWidth={3} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
            
            <div style={{ marginTop: '2rem', maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Month</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Confirmed</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Cancelled</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {[...yearlyStats.monthlyData].reverse().map(d => (
                    <tr key={d.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>{d.month}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>{d.bookings}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#ff7070' }}>{d.cancelled}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--neon-blue)', fontWeight: 600 }}>${d.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'charts' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All-Time Revenue</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--neon-green)', marginTop: '0.5rem' }}>${stats.totalRevenue}</div>
            </div>
            <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue This Month</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.5rem' }}>${stats.thisMonthRevenue}</div>
            </div>
            <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bookings This Month</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--neon-blue)', marginTop: '0.5rem' }}>{stats.thisMonthBookings}</div>
            </div>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', margin: 0 }}>Daily Revenue (Last 30 Days)</h3>
              <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <button onClick={() => setDailyChartType('line')} style={{ padding: '0.25rem 0.75rem', background: dailyChartType === 'line' ? 'var(--neon-blue)' : 'transparent', color: dailyChartType === 'line' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Line</button>
                <button onClick={() => setDailyChartType('bar')} style={{ padding: '0.25rem 0.75rem', background: dailyChartType === 'bar' ? 'var(--neon-blue)' : 'transparent', color: dailyChartType === 'bar' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Bar</button>
                <button onClick={() => setDailyChartType('area')} style={{ padding: '0.25rem 0.75rem', background: dailyChartType === 'area' ? 'var(--neon-blue)' : 'transparent', color: dailyChartType === 'area' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Area</button>
              </div>
            </div>
            <div style={{ height: '300px', width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
              <div style={{ minWidth: '800px', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {dailyChartType === 'line' ? (
                    <LineChart data={stats.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickFormatter={v => v.slice(5)} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border-color)', borderRadius: '8px' }} itemStyle={{ color: 'var(--neon-green)', fontWeight: 600 }} />
                      <Line type="monotone" dataKey="revenue" stroke="var(--neon-green)" strokeWidth={3} dot={{ r: 4, fill: 'var(--neon-green)' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  ) : dailyChartType === 'bar' ? (
                    <BarChart data={stats.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickFormatter={v => v.slice(5)} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border-color)', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} itemStyle={{ color: 'var(--neon-green)', fontWeight: 600 }} />
                      <Bar dataKey="revenue" fill="var(--neon-green)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <AreaChart data={stats.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickFormatter={v => v.slice(5)} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border-color)', borderRadius: '8px' }} itemStyle={{ color: 'var(--neon-green)', fontWeight: 600 }} />
                      <Area type="monotone" dataKey="revenue" stroke="var(--neon-green)" fill="var(--neon-green)" fillOpacity={0.2} strokeWidth={3} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
            
            <div style={{ marginTop: '2rem', maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Date</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Bookings</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats.dailyData].reverse().map(d => (
                    <tr key={d.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>{d.date}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>{d.bookings}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--neon-green)', fontWeight: 600 }}>${d.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', margin: 0 }}>Monthly Revenue (Last 12 Months)</h3>
              <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <button onClick={() => setMonthlyChartType('line')} style={{ padding: '0.25rem 0.75rem', background: monthlyChartType === 'line' ? 'var(--neon-blue)' : 'transparent', color: monthlyChartType === 'line' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Line</button>
                <button onClick={() => setMonthlyChartType('bar')} style={{ padding: '0.25rem 0.75rem', background: monthlyChartType === 'bar' ? 'var(--neon-blue)' : 'transparent', color: monthlyChartType === 'bar' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Bar</button>
                <button onClick={() => setMonthlyChartType('area')} style={{ padding: '0.25rem 0.75rem', background: monthlyChartType === 'area' ? 'var(--neon-blue)' : 'transparent', color: monthlyChartType === 'area' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Area</button>
              </div>
            </div>
            <div style={{ height: '300px', width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
              <div style={{ minWidth: '600px', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {monthlyChartType === 'line' ? (
                    <LineChart data={stats.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border-color)', borderRadius: '8px' }} itemStyle={{ color: 'var(--neon-blue)', fontWeight: 600 }} />
                      <Line type="monotone" dataKey="revenue" stroke="var(--neon-blue)" strokeWidth={3} dot={{ r: 4, fill: 'var(--neon-blue)' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  ) : monthlyChartType === 'bar' ? (
                    <BarChart data={stats.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border-color)', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} itemStyle={{ color: 'var(--neon-blue)', fontWeight: 600 }} />
                      <Bar dataKey="revenue" fill="var(--neon-blue)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <AreaChart data={stats.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border-color)', borderRadius: '8px' }} itemStyle={{ color: 'var(--neon-blue)', fontWeight: 600 }} />
                      <Area type="monotone" dataKey="revenue" stroke="var(--neon-blue)" fill="var(--neon-blue)" fillOpacity={0.2} strokeWidth={3} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
            
            <div style={{ marginTop: '2rem', maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Month</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Bookings</th>
                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats.monthlyData].reverse().map(d => (
                    <tr key={d.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>{d.month}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>{d.bookings}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--neon-blue)', fontWeight: 600 }}>${d.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : sortedDates.length === 0 ? (
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
