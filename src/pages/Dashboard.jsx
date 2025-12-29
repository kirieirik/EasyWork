import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Users,
  Briefcase,
  FileText,
  Clock,
  TrendingUp,
  Plus,
  ArrowRight,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export default function Dashboard() {
  const { profile, organization } = useAuth();
  const [stats, setStats] = useState({
    customers: 0,
    activeJobs: 0,
    pendingQuotes: 0,
    hoursThisWeek: 0
  });
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organization?.id) {
      fetchDashboardData();
    } else {
      // No organization yet, stop loading
      setLoading(false);
    }
  }, [organization]);

  const fetchDashboardData = async () => {
    try {
      // Fetch customers count
      const { count: customersCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id);

      // Fetch active jobs count
      const { count: jobsCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('status', 'in_progress');

      // Fetch pending quotes count
      const { count: quotesCount } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('status', 'pending');

      // Fetch recent jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(name)
        `)
        .eq('organization_id', organization.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      setStats({
        customers: customersCount || 0,
        activeJobs: jobsCount || 0,
        pendingQuotes: quotesCount || 0,
        hoursThisWeek: 0 // TODO: Calculate from time entries
      });
      
      setRecentJobs(jobs || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'God morgen';
    if (hour < 18) return 'God dag';
    return 'God kveld';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'quote':
        return <span className="badge badge-neutral">Tilbud</span>;
      case 'in_progress':
        return <span className="badge badge-primary">Pågår</span>;
      case 'completed':
        return <span className="badge badge-success">Fullført</span>;
      case 'cancelled':
        return <span className="badge badge-danger">Kansellert</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Section */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-xs)' }}>
          {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'bruker'}!
        </h2>
        <p className="text-muted">
          Her er en oversikt over {organization?.name || 'firmaet ditt'} i dag.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <Link to="/kunder" className="stat-card stat-card-clickable">
          <div className="stat-card-header">
            <div className="stat-card-icon primary">
              <Users size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.customers}</div>
          <div className="stat-card-label">Kunder</div>
        </Link>

        <Link to="/jobber" className="stat-card stat-card-clickable">
          <div className="stat-card-header">
            <div className="stat-card-icon success">
              <Briefcase size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.activeJobs}</div>
          <div className="stat-card-label">Aktive jobber</div>
        </Link>

        <Link to="/tilbud" className="stat-card stat-card-clickable">
          <div className="stat-card-header">
            <div className="stat-card-icon warning">
              <FileText size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.pendingQuotes}</div>
          <div className="stat-card-label">Ventende tilbud</div>
        </Link>

        <Link to="/timer" className="stat-card stat-card-clickable">
          <div className="stat-card-header">
            <div className="stat-card-icon primary">
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.hoursThisWeek}</div>
          <div className="stat-card-label">Timer denne uken</div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="card-header">
          <h3 className="card-title">Hurtighandlinger</h3>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <Link to="/kunder/ny" className="btn btn-primary">
            <Plus size={18} />
            Ny kunde
          </Link>
          <Link to="/jobber/ny" className="btn btn-secondary">
            <Plus size={18} />
            Ny jobb
          </Link>
          <Link to="/tilbud/ny" className="btn btn-secondary">
            <Plus size={18} />
            Nytt tilbud
          </Link>
          <Link to="/timer" className="btn btn-secondary">
            <Clock size={18} />
            Registrer timer
          </Link>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Siste jobber</h3>
          <Link to="/jobber" className="btn btn-ghost btn-sm">
            Se alle
            <ArrowRight size={16} />
          </Link>
        </div>

        {recentJobs.length === 0 ? (
          <div className="empty-state">
            <Briefcase className="empty-state-icon" />
            <h3 className="empty-state-title">Ingen jobber ennå</h3>
            <p className="empty-state-description">
              Opprett din første jobb for å komme i gang.
            </p>
            <Link to="/jobber/ny" className="btn btn-primary">
              <Plus size={18} />
              Opprett jobb
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Jobb</th>
                  <th>Kunde</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{job.title}</div>
                      {job.description && (
                        <div className="text-muted truncate" style={{ maxWidth: 200 }}>
                          {job.description}
                        </div>
                      )}
                    </td>
                    <td>{job.customer?.name || '-'}</td>
                    <td>{getStatusBadge(job.status)}</td>
                    <td>
                      <Link to={`/jobber/${job.id}`} className="btn btn-ghost btn-sm">
                        <ArrowRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
