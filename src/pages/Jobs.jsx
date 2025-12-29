import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { nb } from 'date-fns/locale';
import {
  Plus,
  Search,
  Briefcase,
  User,
  Calendar,
  Edit,
  Trash2,
  Grid,
  List,
  MapPin
} from 'lucide-react';
import styles from './Jobs.module.css';

const statusConfig = {
  quote: { label: 'Tilbud', class: 'badge-neutral' },
  in_progress: { label: 'Pågår', class: 'badge-primary' },
  completed: { label: 'Fullført', class: 'badge-success' },
  cancelled: { label: 'Kansellert', class: 'badge-danger' }
};

export default function Jobs() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [deleteModal, setDeleteModal] = useState(null);

  useEffect(() => {
    if (organization?.id) {
      fetchJobs();
    } else {
      setLoading(false);
    }
  }, [organization]);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(id, name),
          assigned:profiles!jobs_assigned_to_fkey(full_name)
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteJob = async (id) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setJobs(jobs.filter(j => j.id !== id));
      setDeleteModal(null);
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Kunne ikke slette jobb. Prøv igjen.');
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.address?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(parseISO(dateString), 'd. MMM yyyy', { locale: nb });
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
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={`search-input-wrapper ${styles.searchWrapper}`}>
            <Search size={18} />
            <input
              type="text"
              className="form-input search-input"
              placeholder="Søk etter jobber..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className={styles.statusFilter}>
            <button
              className={`${styles.statusFilterBtn} ${statusFilter === 'all' ? styles.statusFilterBtnActive : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Alle
            </button>
            <button
              className={`${styles.statusFilterBtn} ${statusFilter === 'in_progress' ? styles.statusFilterBtnActive : ''}`}
              onClick={() => setStatusFilter('in_progress')}
            >
              Pågår
            </button>
            <button
              className={`${styles.statusFilterBtn} ${statusFilter === 'completed' ? styles.statusFilterBtnActive : ''}`}
              onClick={() => setStatusFilter('completed')}
            >
              Fullført
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setViewMode('list')}
              title="Listevisning"
            >
              <List size={18} />
            </button>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setViewMode('grid')}
              title="Kortvisning"
            >
              <Grid size={18} />
            </button>
          </div>
          
          <Link to="/jobber/ny" className="btn btn-primary">
            <Plus size={18} />
            Ny jobb
          </Link>
        </div>
      </div>

      {/* Jobs List/Grid */}
      {filteredJobs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Briefcase className="empty-state-icon" />
            <h3 className="empty-state-title">
              {searchQuery || statusFilter !== 'all' ? 'Ingen jobber funnet' : 'Ingen jobber ennå'}
            </h3>
            <p className="empty-state-description">
              {searchQuery || statusFilter !== 'all'
                ? 'Prøv et annet søkeord eller filter'
                : 'Opprett din første jobb for å komme i gang.'
              }
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Link to="/jobber/ny" className="btn btn-primary">
                <Plus size={18} />
                Opprett jobb
              </Link>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className={styles.jobsGrid}>
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className={styles.jobCard}
              onClick={() => navigate(`/jobber/${job.id}`)}
            >
              <div className={styles.jobCardInner}>
                <div className={styles.jobCardHeader}>
                  <div>
                    <div className={styles.jobCardTitle}>{job.title}</div>
                    {job.customer && (
                      <div className={styles.jobCardCustomer}>
                        <User size={12} />
                        {job.customer.name}
                      </div>
                    )}
                  </div>
                  <span className={`badge ${statusConfig[job.status]?.class || 'badge-neutral'}`}>
                    {statusConfig[job.status]?.label || job.status}
                  </span>
                </div>
                
                <div className={styles.jobCardMeta}>
                  {job.scheduled_date && (
                    <div className={styles.jobCardMetaItem}>
                      <Calendar size={12} />
                      {formatDate(job.scheduled_date)}
                    </div>
                  )}
                  {job.address && (
                    <div className={styles.jobCardMetaItem}>
                      <MapPin size={12} />
                      {job.address}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Jobb</th>
                  <th>Kunde</th>
                  <th>Dato</th>
                  <th>Status</th>
                  <th className={styles.actionsColumn}></th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    className={styles.clickableRow}
                    onClick={() => navigate(`/jobber/${job.id}`)}
                  >
                    <td>
                      <div className={styles.jobTitle}>{job.title}</div>
                      {job.description && (
                        <div className={`text-muted truncate ${styles.jobDescription}`}>
                          {job.description}
                        </div>
                      )}
                    </td>
                    <td>
                      {job.customer ? (
                        <div className={styles.customerCell}>
                          <User size={14} className="text-muted" />
                          {job.customer.name}
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      {job.scheduled_date ? (
                        <div className={styles.dateCell}>
                          <Calendar size={14} className="text-muted" />
                          {formatDate(job.scheduled_date)}
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      <span className={`badge ${statusConfig[job.status]?.class || 'badge-neutral'}`}>
                        {statusConfig[job.status]?.label || job.status}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/jobber/${job.id}/rediger`);
                          }}
                          title="Rediger"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className={`btn btn-ghost btn-icon btn-sm ${styles.deleteBtn}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteModal(job);
                          }}
                          title="Slett"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Slett jobb</h3>
              <button className="modal-close" onClick={() => setDeleteModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Er du sikker på at du vil slette <strong>{deleteModal.title}</strong>?</p>
              <p className="text-muted mt-sm">
                Denne handlingen kan ikke angres. Timer og notater knyttet til jobben vil også bli slettet.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteModal(null)}
              >
                Avbryt
              </button>
              <button
                className="btn btn-danger"
                onClick={() => deleteJob(deleteModal.id)}
              >
                Slett
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
