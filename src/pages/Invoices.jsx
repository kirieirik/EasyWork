import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Send,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  MoreVertical,
  Eye,
  Mail,
  Download,
  Trash2
} from 'lucide-react';
import styles from './Invoices.module.css';

const STATUS_CONFIG = {
  draft: { label: 'Utkast', icon: FileText, color: 'var(--color-text-secondary)' },
  sent: { label: 'Sendt', icon: Send, color: 'var(--color-primary)' },
  paid: { label: 'Betalt', icon: CheckCircle, color: 'var(--color-success)' },
  overdue: { label: 'Forfalt', icon: AlertTriangle, color: 'var(--color-error)' },
  cancelled: { label: 'Kansellert', icon: XCircle, color: 'var(--color-text-muted)' }
};

export default function Invoices() {
  const navigate = useNavigate();
  const { organization } = useAuth();
  
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeMenu, setActiveMenu] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);

  useEffect(() => {
    if (organization?.id) {
      fetchInvoices();
    }
  }, [organization]);

  // Check for overdue invoices
  useEffect(() => {
    const checkOverdue = async () => {
      const today = new Date().toISOString().split('T')[0];
      const overdueInvoices = invoices.filter(
        inv => inv.status === 'sent' && inv.due_date && inv.due_date < today
      );
      
      if (overdueInvoices.length > 0) {
        // Update status to overdue
        for (const inv of overdueInvoices) {
          await supabase
            .from('invoices')
            .update({ status: 'overdue' })
            .eq('id', inv.id);
        }
        fetchInvoices();
      }
    };
    
    if (invoices.length > 0) {
      checkOverdue();
    }
  }, [invoices.length]);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, name, email),
          job:jobs(id, title)
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setInvoices(invoices.filter(inv => inv.id !== id));
      setDeleteModal(null);
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Kunne ikke slette faktura. Prøv igjen.');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const updates = { status: newStatus };
      
      if (newStatus === 'sent') {
        updates.sent_at = new Date().toISOString();
      } else if (newStatus === 'paid') {
        updates.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setInvoices(invoices.map(inv => 
        inv.id === id ? { ...inv, ...updates } : inv
      ));
      setActiveMenu(null);
    } catch (error) {
      console.error('Error updating invoice:', error);
      alert('Kunne ikke oppdatere faktura. Prøv igjen.');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number?.toString().includes(searchQuery) ||
      invoice.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Statistics
  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    totalAmount: invoices.filter(i => i.status !== 'cancelled').reduce((sum, i) => sum + (i.total || 0), 0),
    paidAmount: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0),
    pendingAmount: invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((sum, i) => sum + (i.total || 0), 0)
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Fakturaer</h1>
          <p className={styles.subtitle}>
            {stats.total} {stats.total === 1 ? 'faktura' : 'fakturaer'} totalt
          </p>
        </div>
        <Link to="/fakturaer/ny" className="btn btn-primary">
          <Plus size={18} />
          Ny faktura
        </Link>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Totalt fakturert</span>
          <span className={styles.statValue}>{formatCurrency(stats.totalAmount)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Betalt</span>
          <span className={`${styles.statValue} ${styles.statSuccess}`}>{formatCurrency(stats.paidAmount)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Utestående</span>
          <span className={`${styles.statValue} ${styles.statWarning}`}>{formatCurrency(stats.pendingAmount)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Forfalt</span>
          <span className={`${styles.statValue} ${styles.statDanger}`}>{stats.overdue}</span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            className={`form-input ${styles.searchInput}`}
            placeholder="Søk på fakturanummer, tittel eller kunde..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className={styles.statusFilters}>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'all' ? styles.filterBtnActive : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Alle
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <button
              key={key}
              className={`${styles.filterBtn} ${statusFilter === key ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <div className={styles.emptyState}>
          <FileText size={48} strokeWidth={1.5} />
          <h3>Ingen fakturaer</h3>
          <p>
            {searchQuery || statusFilter !== 'all'
              ? 'Ingen fakturaer matcher søket ditt.'
              : 'Opprett din første faktura for å komme i gang.'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Link to="/fakturaer/ny" className="btn btn-primary">
              <Plus size={18} />
              Ny faktura
            </Link>
          )}
        </div>
      ) : (
        <div className={styles.invoicesList}>
          <div className={styles.listHeader}>
            <span>Faktura</span>
            <span>Kunde</span>
            <span>Dato</span>
            <span>Forfall</span>
            <span>Beløp</span>
            <span>Status</span>
            <span></span>
          </div>
          
          {filteredInvoices.map(invoice => {
            const status = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
            const StatusIcon = status.icon;
            const isOverdue = invoice.status === 'sent' && 
              invoice.due_date && 
              new Date(invoice.due_date) < new Date();

            return (
              <div 
                key={invoice.id} 
                className={styles.invoiceRow}
                onClick={() => navigate(`/fakturaer/${invoice.id}`)}
              >
                <div className={styles.invoiceInfo}>
                  <span className={styles.invoiceNumber}>#{invoice.invoice_number}</span>
                  <span className={styles.invoiceTitle}>{invoice.title || 'Uten tittel'}</span>
                </div>
                <span className={styles.customerName}>
                  {invoice.customer?.name || 'Ingen kunde'}
                </span>
                <span className={styles.date}>
                  {invoice.invoice_date 
                    ? format(new Date(invoice.invoice_date), 'd. MMM yyyy', { locale: nb })
                    : '-'}
                </span>
                <span className={`${styles.date} ${isOverdue ? styles.overdueDate : ''}`}>
                  {invoice.due_date 
                    ? format(new Date(invoice.due_date), 'd. MMM yyyy', { locale: nb })
                    : '-'}
                </span>
                <span className={styles.amount}>
                  {formatCurrency(invoice.total)}
                </span>
                <span 
                  className={styles.statusBadge}
                  style={{ 
                    backgroundColor: `${status.color}15`,
                    color: status.color 
                  }}
                >
                  <StatusIcon size={14} />
                  {status.label}
                </span>
                <div className={styles.actions} onClick={e => e.stopPropagation()}>
                  <button
                    className={styles.menuBtn}
                    onClick={() => setActiveMenu(activeMenu === invoice.id ? null : invoice.id)}
                  >
                    <MoreVertical size={18} />
                  </button>
                  
                  {activeMenu === invoice.id && (
                    <div className={styles.dropdown}>
                      <button onClick={() => navigate(`/fakturaer/${invoice.id}`)}>
                        <Eye size={16} />
                        Vis faktura
                      </button>
                      {invoice.status === 'draft' && (
                        <button onClick={() => handleStatusChange(invoice.id, 'sent')}>
                          <Send size={16} />
                          Marker som sendt
                        </button>
                      )}
                      {['sent', 'overdue'].includes(invoice.status) && (
                        <button onClick={() => handleStatusChange(invoice.id, 'paid')}>
                          <CheckCircle size={16} />
                          Marker som betalt
                        </button>
                      )}
                      {invoice.customer?.email && invoice.status === 'draft' && (
                        <button onClick={() => navigate(`/fakturaer/${invoice.id}?send=true`)}>
                          <Mail size={16} />
                          Send på e-post
                        </button>
                      )}
                      <button onClick={() => navigate(`/fakturaer/${invoice.id}?pdf=true`)}>
                        <Download size={16} />
                        Last ned PDF
                      </button>
                      {invoice.status === 'draft' && (
                        <button 
                          className={styles.deleteBtn}
                          onClick={() => setDeleteModal(invoice)}
                        >
                          <Trash2 size={16} />
                          Slett
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Mobile Invoice Cards */}
          <div className={styles.mobileInvoiceCards}>
            {filteredInvoices.map(invoice => {
              const status = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
              const StatusIcon = status.icon;
              const isOverdue = invoice.status === 'sent' && 
                invoice.due_date && 
                new Date(invoice.due_date) < new Date();

              return (
                <div 
                  key={invoice.id} 
                  className={styles.mobileInvoiceCard}
                  onClick={() => navigate(`/fakturaer/${invoice.id}`)}
                >
                  <div className={styles.mobileCardHeader}>
                    <div className={styles.mobileCardInfo}>
                      <h4>#{invoice.invoice_number} {invoice.title || ''}</h4>
                      <span>{invoice.customer?.name || 'Ingen kunde'}</span>
                    </div>
                    <span 
                      className={styles.statusBadge}
                      style={{ 
                        backgroundColor: `${status.color}15`,
                        color: status.color 
                      }}
                    >
                      <StatusIcon size={14} />
                      {status.label}
                    </span>
                  </div>
                  <div className={styles.mobileCardGrid}>
                    <div className={styles.mobileCardItem}>
                      <span className={styles.mobileCardLabel}>Fakturadato</span>
                      <span className={styles.mobileCardValue}>
                        {invoice.invoice_date 
                          ? format(new Date(invoice.invoice_date), 'd. MMM yyyy', { locale: nb })
                          : '-'}
                      </span>
                    </div>
                    <div className={styles.mobileCardItem}>
                      <span className={styles.mobileCardLabel}>Forfall</span>
                      <span className={`${styles.mobileCardValue} ${isOverdue ? styles.overdue : ''}`}>
                        {invoice.due_date 
                          ? format(new Date(invoice.due_date), 'd. MMM yyyy', { locale: nb })
                          : '-'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.mobileCardFooter}>
                    <span className={styles.mobileCardAmount}>{formatCurrency(invoice.total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Slett faktura</h3>
            </div>
            <div className="modal-body">
              <p>Er du sikker på at du vil slette faktura <strong>#{deleteModal.invoice_number}</strong>?</p>
              <p className={styles.deleteWarning}>Denne handlingen kan ikke angres.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>
                Avbryt
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => handleDelete(deleteModal.id)}
              >
                Slett faktura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
