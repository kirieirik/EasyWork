import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generateQuotePDF } from '../lib/generateQuotePDF';
import { generateQuotePDFBase64 } from '../lib/generateQuotePDF';
import SendQuoteModal from '../components/SendQuoteModal';
import { format, parseISO, isPast } from 'date-fns';
import { nb } from 'date-fns/locale';
import {
  Plus,
  Search,
  FileText,
  User,
  Calendar,
  Edit,
  Trash2,
  Grid,
  List,
  Briefcase,
  Send,
  Eye,
  Download,
  Loader2,
  Mail
} from 'lucide-react';
import styles from './Quotes.module.css';

const statusConfig = {
  draft: { label: 'Utkast', class: 'badge-neutral' },
  pending: { label: 'Sendt', class: 'badge-warning' },
  accepted: { label: 'Akseptert', class: 'badge-success' },
  rejected: { label: 'Avslått', class: 'badge-danger' },
  expired: { label: 'Utløpt', class: 'badge-neutral' }
};

export default function Quotes() {
  const { organization, profile, user } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [deleteModal, setDeleteModal] = useState(null);
  const [convertModal, setConvertModal] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(null);
  const [sendModal, setSendModal] = useState(null);
  const [sendModalCustomer, setSendModalCustomer] = useState(null);

  useEffect(() => {
    if (organization?.id) {
      fetchQuotes();
    } else {
      setLoading(false);
    }
  }, [organization]);

  const fetchQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(id, name)
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Check for expired quotes
      const updatedQuotes = (data || []).map(quote => {
        if (quote.status === 'pending' && quote.valid_until && isPast(parseISO(quote.valid_until))) {
          return { ...quote, status: 'expired' };
        }
        return quote;
      });
      
      setQuotes(updatedQuotes);
    } catch (error) {
      console.error('Error fetching quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (quote, e) => {
    e.stopPropagation();
    setGeneratingPDF(quote.id);

    try {
      // Fetch quote lines
      const { data: lines, error: linesError } = await supabase
        .from('quote_lines')
        .select('*')
        .eq('quote_id', quote.id)
        .order('sort_order', { ascending: true });

      if (linesError) throw linesError;

      // Fetch full customer data if exists
      let customer = quote.customer;
      if (quote.customer_id && !quote.customer?.address) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', quote.customer_id)
          .single();
        customer = customerData;
      }

      // Generate PDF
      await generateQuotePDF(quote, lines || [], organization, profile, customer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Kunne ikke generere PDF. Prøv igjen.');
    } finally {
      setGeneratingPDF(null);
    }
  };

  const handleSendQuote = async (quote, e) => {
    e?.stopPropagation();
    
    // Fetch full customer data
    let customer = null;
    if (quote.customer_id) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', quote.customer_id)
        .single();
      customer = customerData;
    }
    
    setSendModalCustomer(customer);
    setSendModal(quote);
  };

  const handleSendEmail = async ({ to, bcc, subject, message }) => {
    // Fetch quote lines for PDF
    const { data: lines, error: linesError } = await supabase
      .from('quote_lines')
      .select('*')
      .eq('quote_id', sendModal.id)
      .order('sort_order', { ascending: true });

    if (linesError) throw linesError;

    // Generate PDF as base64
    const pdfBase64 = await generateQuotePDFBase64(
      sendModal,
      lines || [],
      organization,
      profile,
      sendModalCustomer
    );

    // Call Supabase Edge Function to send email
    const { data, error } = await supabase.functions.invoke('send-quote-email', {
      body: {
        to,
        bcc,
        replyTo: user?.email,
        subject,
        message,
        pdfBase64,
        quoteNumber: sendModal.quote_number,
        quoteTitle: sendModal.title,
        organizationName: organization?.name
      }
    });

    if (error) throw error;

    // Update quote status to 'pending' (sent)
    if (sendModal.status === 'draft') {
      const { error: updateError } = await supabase
        .from('quotes')
        .update({ status: 'pending' })
        .eq('id', sendModal.id);

      if (!updateError) {
        setQuotes(quotes.map(q => 
          q.id === sendModal.id ? { ...q, status: 'pending' } : q
        ));
      }
    }

    return data;
  };

  const deleteQuote = async (id) => {
    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setQuotes(quotes.filter(q => q.id !== id));
      setDeleteModal(null);
    } catch (error) {
      console.error('Error deleting quote:', error);
      alert('Kunne ikke slette tilbud. Prøv igjen.');
    }
  };

  const convertToJob = async (quote) => {
    try {
      // Create a new job from the quote
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert([{
          organization_id: organization.id,
          customer_id: quote.customer_id,
          title: quote.title,
          description: quote.description,
          status: 'in_progress'
        }])
        .select()
        .single();

      if (jobError) throw jobError;

      // Fetch quote lines
      const { data: quoteLines, error: quoteLinesError } = await supabase
        .from('quote_lines')
        .select('*')
        .eq('quote_id', quote.id)
        .order('sort_order');

      if (quoteLinesError) throw quoteLinesError;

      // Copy quote lines to job lines
      if (quoteLines && quoteLines.length > 0) {
        const jobLines = quoteLines.map(line => ({
          job_id: job.id,
          article_id: line.article_id,
          description: line.description,
          quantity: line.quantity,
          unit_name: line.unit_name,
          cost_price: line.cost_price,
          unit_price: line.unit_price,
          vat_rate: line.vat_rate,
          total: line.total,
          sort_order: line.sort_order,
          quantity_invoiced: 0
        }));

        const { error: jobLinesError } = await supabase
          .from('job_lines')
          .insert(jobLines);

        if (jobLinesError) throw jobLinesError;
      }

      // Update quote status to accepted and link to job
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          job_id: job.id
        })
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

      // Update local state
      setQuotes(quotes.map(q => 
        q.id === quote.id 
          ? { ...q, status: 'accepted', job_id: job.id }
          : q
      ));

      setConvertModal(null);
      navigate(`/jobber/${job.id}`);
    } catch (error) {
      console.error('Error converting quote to job:', error);
      alert('Kunne ikke konvertere tilbud. Prøv igjen.');
    }
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = 
      quote.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(parseISO(dateString), 'd. MMM yyyy', { locale: nb });
  };

  const getCardGradientClass = (status) => {
    switch (status) {
      case 'draft': return styles.quoteCardDraft;
      case 'pending': return styles.quoteCardPending;
      case 'accepted': return styles.quoteCardAccepted;
      case 'rejected': return styles.quoteCardRejected;
      default: return styles.quoteCardDraft;
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
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={`search-input-wrapper ${styles.searchWrapper}`}>
            <Search size={18} />
            <input
              type="text"
              className="form-input search-input"
              placeholder="Søk etter tilbud..."
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
              className={`${styles.statusFilterBtn} ${statusFilter === 'pending' ? styles.statusFilterBtnActive : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              Sendt
            </button>
            <button
              className={`${styles.statusFilterBtn} ${statusFilter === 'accepted' ? styles.statusFilterBtnActive : ''}`}
              onClick={() => setStatusFilter('accepted')}
            >
              Akseptert
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setViewMode('grid')}
              title="Kortvisning"
            >
              <Grid size={18} />
            </button>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setViewMode('list')}
              title="Listevisning"
            >
              <List size={18} />
            </button>
          </div>
          
          <Link to="/tilbud/ny" className="btn btn-primary">
            <Plus size={18} />
            Nytt tilbud
          </Link>
        </div>
      </div>

      {/* Quotes Grid/List */}
      {filteredQuotes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <FileText className="empty-state-icon" />
            <h3 className="empty-state-title">
              {searchQuery || statusFilter !== 'all' ? 'Ingen tilbud funnet' : 'Ingen tilbud ennå'}
            </h3>
            <p className="empty-state-description">
              {searchQuery || statusFilter !== 'all'
                ? 'Prøv et annet søkeord eller filter'
                : 'Opprett ditt første tilbud for å komme i gang.'
              }
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Link to="/tilbud/ny" className="btn btn-primary">
                <Plus size={18} />
                Opprett tilbud
              </Link>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className={styles.quotesGrid}>
          {filteredQuotes.map((quote) => (
            <div
              key={quote.id}
              className={`${styles.quoteCard} ${getCardGradientClass(quote.status)}`}
              onClick={() => navigate(`/tilbud/${quote.id}`)}
            >
              <div className={styles.quoteCardInner}>
                <div className={styles.quoteCardHeader}>
                  <div>
                    <div className={styles.quoteCardNumber}>#{quote.quote_number}</div>
                    <div className={styles.quoteCardTitle}>{quote.title}</div>
                    {quote.customer && (
                      <div className={styles.quoteCardCustomer}>
                        <User size={12} />
                        {quote.customer.name}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className={`badge ${statusConfig[quote.status]?.class || 'badge-neutral'}`}>
                      {statusConfig[quote.status]?.label || quote.status}
                    </span>
                    <div className={styles.quoteCardTotal}>
                      {formatCurrency(quote.total)}
                      <div className={styles.quoteCardTotalLabel}>inkl. mva</div>
                    </div>
                  </div>
                </div>
                
                <div className={styles.quoteCardMeta}>
                  <div className={styles.quoteCardDate}>
                    <Calendar size={12} />
                    Gyldig til: {formatDate(quote.valid_until)}
                  </div>
                  <div className={styles.quoteCardActions}>
                    <button
                      className={styles.sendBtn}
                      onClick={(e) => handleSendQuote(quote, e)}
                      title="Send tilbud"
                    >
                      <Mail size={12} />
                      Send
                    </button>
                    <button
                      className={styles.pdfBtn}
                      onClick={(e) => handleDownloadPDF(quote, e)}
                      disabled={generatingPDF === quote.id}
                      title="Last ned PDF"
                    >
                      {generatingPDF === quote.id ? (
                        <Loader2 size={12} className={styles.spinning} />
                      ) : (
                        <Download size={12} />
                      )}
                      PDF
                    </button>
                    {quote.status === 'pending' && (
                      <button
                        className={styles.convertBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConvertModal(quote);
                        }}
                        title="Konverter til jobb"
                      >
                        <Briefcase size={12} />
                        Til jobb
                      </button>
                    )}
                  </div>
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
                  <th>Tilbud</th>
                  <th>Kunde</th>
                  <th>Sum</th>
                  <th>Gyldig til</th>
                  <th>Status</th>
                  <th className={styles.actionsColumn}></th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className={styles.clickableRow}
                    onClick={() => navigate(`/tilbud/${quote.id}`)}
                  >
                    <td>
                      <div className={styles.quoteNumber}>#{quote.quote_number}</div>
                      <div className={styles.quoteTitle}>{quote.title}</div>
                    </td>
                    <td>
                      {quote.customer ? (
                        <div className={styles.customerCell}>
                          <User size={14} className="text-muted" />
                          {quote.customer.name}
                        </div>
                      ) : '-'}
                    </td>
                    <td className={styles.totalCell}>
                      {formatCurrency(quote.total)}
                    </td>
                    <td className={styles.dateCell}>
                      {formatDate(quote.valid_until)}
                    </td>
                    <td>
                      <span className={`badge ${statusConfig[quote.status]?.class || 'badge-neutral'}`}>
                        {statusConfig[quote.status]?.label || quote.status}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button
                          className={styles.sendBtn}
                          onClick={(e) => handleSendQuote(quote, e)}
                          title="Send tilbud"
                        >
                          <Mail size={14} />
                        </button>
                        <button
                          className={styles.pdfBtn}
                          onClick={(e) => handleDownloadPDF(quote, e)}
                          disabled={generatingPDF === quote.id}
                          title="Last ned PDF"
                        >
                          {generatingPDF === quote.id ? (
                            <Loader2 size={12} className={styles.spinning} />
                          ) : (
                            <Download size={12} />
                          )}
                        </button>
                        {quote.status === 'pending' && (
                          <button
                            className={styles.convertBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConvertModal(quote);
                            }}
                            title="Konverter til jobb"
                          >
                            <Briefcase size={12} />
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/tilbud/${quote.id}/rediger`);
                          }}
                          title="Rediger"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className={`btn btn-ghost btn-icon btn-sm ${styles.deleteBtn}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteModal(quote);
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
              <h3 className="modal-title">Slett tilbud</h3>
              <button className="modal-close" onClick={() => setDeleteModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Er du sikker på at du vil slette tilbud <strong>#{deleteModal.quote_number}</strong>?</p>
              <p className="text-muted mt-sm">
                Denne handlingen kan ikke angres.
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
                onClick={() => deleteQuote(deleteModal.id)}
              >
                Slett
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Quote Modal */}
      <SendQuoteModal
        isOpen={!!sendModal}
        onClose={() => {
          setSendModal(null);
          setSendModalCustomer(null);
        }}
        quote={sendModal}
        customer={sendModalCustomer}
        organization={organization}
        userEmail={user?.email || profile?.email}
        onSend={handleSendEmail}
      />

      {/* Convert to Job Modal */}
      {convertModal && (
        <div className="modal-overlay" onClick={() => setConvertModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Konverter til jobb</h3>
              <button className="modal-close" onClick={() => setConvertModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Vil du konvertere tilbud <strong>#{convertModal.quote_number} - {convertModal.title}</strong> til en aktiv jobb?
              </p>
              <p className="text-muted mt-sm">
                Tilbudet blir markert som "Akseptert" og en ny jobb opprettes automatisk.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setConvertModal(null)}
              >
                Avbryt
              </button>
              <button
                className="btn btn-primary"
                onClick={() => convertToJob(convertModal)}
              >
                <Briefcase size={16} />
                Konverter til jobb
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
