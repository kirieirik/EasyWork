import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import {
  ArrowLeft,
  Save,
  Send,
  Download,
  CheckCircle,
  Clock,
  FileText,
  User,
  Building,
  Calendar,
  CreditCard,
  Plus,
  Trash2,
  Edit,
  X,
  Mail,
  AlertTriangle
} from 'lucide-react';
import DateInput from '../components/DateInput';
import styles from './InvoiceDetail.module.css';

const STATUS_CONFIG = {
  draft: { label: 'Utkast', color: 'var(--color-text-secondary)' },
  sent: { label: 'Sendt', color: 'var(--color-primary)' },
  paid: { label: 'Betalt', color: 'var(--color-success)' },
  overdue: { label: 'Forfalt', color: 'var(--color-error)' },
  cancelled: { label: 'Kansellert', color: 'var(--color-text-muted)' }
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { organization, profile } = useAuth();
  const isNew = id === 'ny';
  
  const [invoice, setInvoice] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showAddLine, setShowAddLine] = useState(false);
  const [editingLine, setEditingLine] = useState(null);
  const [sendModal, setSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  
  const customerSearchRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    invoice_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    status: 'draft',
    notes: '',
    terms: 'Betaling innen forfallsdato. Ved forsinket betaling påløper forsinkelsesrenter.',
    payment_reference: ''
  });

  const [newLine, setNewLine] = useState({
    description: '',
    quantity: 1,
    unit_name: 'stk',
    unit_price: 0,
    cost_price: 0,
    vat_rate: 25
  });

  useEffect(() => {
    fetchCustomers();
    if (!isNew) {
      fetchInvoice();
    }
  }, [id, organization]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if should open send modal from URL
  useEffect(() => {
    if (searchParams.get('send') === 'true' && invoice) {
      setSendModal(true);
    }
  }, [searchParams, invoice]);

  const fetchCustomers = async () => {
    if (!organization?.id) return;
    
    const { data } = await supabase
      .from('customers')
      .select('id, name, email, phone, address, postal_code, city, organization_number')
      .eq('organization_id', organization.id)
      .order('name');
    
    setCustomers(data || []);
  };

  const fetchInvoice = async () => {
    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', id)
        .single();

      if (invoiceError) throw invoiceError;
      
      setInvoice(invoiceData);
      setSelectedCustomer(invoiceData.customer);
      setFormData({
        title: invoiceData.title || '',
        description: invoiceData.description || '',
        invoice_date: invoiceData.invoice_date || format(new Date(), 'yyyy-MM-dd'),
        due_date: invoiceData.due_date || '',
        status: invoiceData.status || 'draft',
        notes: invoiceData.notes || '',
        terms: invoiceData.terms || '',
        payment_reference: invoiceData.payment_reference || ''
      });

      // Fetch invoice lines
      const { data: linesData, error: linesError } = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', id)
        .order('sort_order');

      if (linesError) throw linesError;
      setLines(linesData || []);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      navigate('/fakturaer');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let vatAmount = 0;
    
    lines.forEach(line => {
      const lineTotal = (line.quantity || 0) * (line.unit_price || 0);
      subtotal += lineTotal;
      vatAmount += lineTotal * ((line.vat_rate || 25) / 100);
    });

    return {
      subtotal,
      vatAmount,
      total: subtotal + vatAmount
    };
  };

  const handleSave = async () => {
    if (!selectedCustomer) {
      alert('Velg en kunde');
      return;
    }

    setSaving(true);
    try {
      const totals = calculateTotals();
      const invoiceData = {
        organization_id: organization.id,
        customer_id: selectedCustomer.id,
        ...formData,
        subtotal: totals.subtotal,
        vat_amount: totals.vatAmount,
        total: totals.total,
        invoice_date: formData.invoice_date || null,
        due_date: formData.due_date || null
      };

      if (isNew) {
        // Get next invoice number
        const { data: nextNum } = await supabase
          .rpc('get_next_invoice_number', { org_id: organization.id });

        invoiceData.invoice_number = nextNum || 1;
        invoiceData.created_by = profile?.id;

        const { data: newInvoice, error } = await supabase
          .from('invoices')
          .insert([invoiceData])
          .select()
          .single();

        if (error) throw error;

        // Insert lines if any
        if (lines.length > 0) {
          const invoiceLines = lines.map((line, idx) => ({
            invoice_id: newInvoice.id,
            ...line,
            sort_order: idx
          }));

          await supabase.from('invoice_lines').insert(invoiceLines);
        }

        navigate(`/fakturaer/${newInvoice.id}`, { replace: true });
      } else {
        const { error } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', id);

        if (error) throw error;
        
        setInvoice({ ...invoice, ...invoiceData });
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Kunne ikke lagre faktura. Prøv igjen.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLine = async () => {
    if (!newLine.description.trim()) return;

    // Calculate total for the line
    const lineTotal = newLine.quantity * newLine.unit_price;
    const lineWithTotal = { ...newLine, total: lineTotal };

    if (isNew) {
      // For new invoices, just add to local state
      setLines([...lines, { ...lineWithTotal, id: `temp-${Date.now()}` }]);
    } else {
      // For existing invoices, save to database
      try {
        const { data, error } = await supabase
          .from('invoice_lines')
          .insert([{
            invoice_id: id,
            ...lineWithTotal,
            sort_order: lines.length
          }])
          .select()
          .single();

        if (error) throw error;
        setLines([...lines, data]);
      } catch (error) {
        console.error('Error adding line:', error);
        alert('Kunne ikke legge til linje. Prøv igjen.');
        return;
      }
    }

    setNewLine({
      description: '',
      quantity: 1,
      unit_name: 'stk',
      unit_price: 0,
      cost_price: 0,
      vat_rate: 25
    });
    setShowAddLine(false);
  };

  const handleUpdateLine = async (lineId, updates) => {
    if (isNew || lineId.toString().startsWith('temp-')) {
      setLines(lines.map(l => l.id === lineId ? { ...l, ...updates } : l));
    } else {
      try {
        await supabase
          .from('invoice_lines')
          .update(updates)
          .eq('id', lineId);
        
        setLines(lines.map(l => l.id === lineId ? { ...l, ...updates } : l));
      } catch (error) {
        console.error('Error updating line:', error);
      }
    }
    setEditingLine(null);
  };

  const handleDeleteLine = async (lineId) => {
    if (isNew || lineId.toString().startsWith('temp-')) {
      setLines(lines.filter(l => l.id !== lineId));
    } else {
      try {
        await supabase
          .from('invoice_lines')
          .delete()
          .eq('id', lineId);
        
        setLines(lines.filter(l => l.id !== lineId));
      } catch (error) {
        console.error('Error deleting line:', error);
      }
    }
  };

  const handleSendEmail = async () => {
    if (!selectedCustomer?.email) {
      alert('Kunden har ingen e-postadresse');
      return;
    }

    setSending(true);
    try {
      // First save any changes
      await handleSave();

      // Call Edge Function to send email
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoiceId: id,
          customerEmail: selectedCustomer.email,
          customerName: selectedCustomer.name,
          organizationName: organization.name,
          invoiceNumber: invoice?.invoice_number,
          total: calculateTotals().total,
          dueDate: formData.due_date
        }
      });

      if (error) throw error;

      // Update status to sent
      await supabase
        .from('invoices')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', id);

      setFormData({ ...formData, status: 'sent' });
      setInvoice({ ...invoice, status: 'sent', sent_at: new Date().toISOString() });
      setSendModal(false);
      alert('Faktura sendt til ' + selectedCustomer.email);
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Kunne ikke sende faktura. Prøv igjen.');
    } finally {
      setSending(false);
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      await supabase
        .from('invoices')
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', id);

      setFormData({ ...formData, status: 'paid' });
      setInvoice({ ...invoice, status: 'paid', paid_at: new Date().toISOString() });
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('Kunne ikke oppdatere status. Prøv igjen.');
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

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  const totals = calculateTotals();
  const status = STATUS_CONFIG[formData.status] || STATUS_CONFIG.draft;
  const canEdit = formData.status === 'draft';

  return (
    <div className="page-container">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/fakturaer" className={styles.backButton}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className={styles.title}>
              {isNew ? 'Ny faktura' : `Faktura #${invoice?.invoice_number}`}
            </h1>
            {!isNew && (
              <span 
                className={styles.statusBadge}
                style={{ backgroundColor: status.color }}
              >
                {status.label}
              </span>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          {canEdit && (
            <button 
              className="btn btn-secondary"
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={18} />
              {saving ? 'Lagrer...' : 'Lagre'}
            </button>
          )}
          {!isNew && formData.status === 'draft' && selectedCustomer?.email && (
            <button 
              className="btn btn-primary"
              onClick={() => setSendModal(true)}
            >
              <Send size={18} />
              Send faktura
            </button>
          )}
          {['sent', 'overdue'].includes(formData.status) && (
            <button 
              className="btn btn-success"
              onClick={handleMarkAsPaid}
            >
              <CheckCircle size={18} />
              Marker som betalt
            </button>
          )}
        </div>
      </div>

      <div className={styles.content}>
        {/* Left Column - Form */}
        <div className={styles.formColumn}>
          {/* Customer Selection */}
          <div className={`card ${styles.card}`}>
            <h3 className={styles.cardTitle}>
              <User size={18} />
              Kunde
            </h3>
            
            {canEdit ? (
              <div className={styles.customerSelect} ref={customerSearchRef}>
                {selectedCustomer ? (
                  <div className={styles.selectedCustomer}>
                    <div>
                      <strong>{selectedCustomer.name}</strong>
                      {selectedCustomer.email && <p>{selectedCustomer.email}</p>}
                      {selectedCustomer.address && (
                        <p>{selectedCustomer.address}, {selectedCustomer.postal_code} {selectedCustomer.city}</p>
                      )}
                    </div>
                    <button 
                      className={styles.changeBtn}
                      onClick={() => {
                        setSelectedCustomer(null);
                        setShowCustomerDropdown(true);
                      }}
                    >
                      Endre
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Søk etter kunde..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                    />
                    {showCustomerDropdown && filteredCustomers.length > 0 && (
                      <div className={styles.customerDropdown}>
                        {filteredCustomers.map(customer => (
                          <div
                            key={customer.id}
                            className={styles.customerOption}
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setCustomerSearch('');
                              setShowCustomerDropdown(false);
                            }}
                          >
                            <strong>{customer.name}</strong>
                            {customer.email && <span>{customer.email}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className={styles.customerInfo}>
                <strong>{selectedCustomer?.name}</strong>
                {selectedCustomer?.email && <p>{selectedCustomer.email}</p>}
                {selectedCustomer?.address && (
                  <p>{selectedCustomer.address}, {selectedCustomer.postal_code} {selectedCustomer.city}</p>
                )}
              </div>
            )}
          </div>

          {/* Invoice Details */}
          <div className={`card ${styles.card}`}>
            <h3 className={styles.cardTitle}>
              <FileText size={18} />
              Fakturadetaljer
            </h3>
            
            <div className="form-group">
              <label className="form-label">Tittel</label>
              <input
                type="text"
                className="form-input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="F.eks. Arbeid utført i desember"
                disabled={!canEdit}
              />
            </div>

            <div className={styles.dateRow}>
              <div className="form-group">
                <label className="form-label">Fakturadato</label>
                <DateInput
                  name="invoice_date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Forfallsdato</label>
                <DateInput
                  name="due_date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Beskrivelse</label>
              <textarea
                className="form-input"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Beskrivelse av arbeidet..."
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Invoice Lines */}
          <div className={`card ${styles.card}`}>
            <div className={styles.linesHeader}>
              <h3 className={styles.cardTitle}>
                <CreditCard size={18} />
                Fakturalinjer
              </h3>
              {canEdit && (
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddLine(true)}
                >
                  <Plus size={16} />
                  Legg til
                </button>
              )}
            </div>

            {lines.length === 0 ? (
              <p className={styles.noLines}>Ingen linjer lagt til</p>
            ) : (
              <>
                {/* Desktop Table */}
                <div className={styles.desktopLinesTable}>
                  <div className={styles.linesTable}>
                    <div className={styles.linesTableHeader}>
                      <span>Beskrivelse</span>
                      <span>Antall</span>
                      <span>Pris</span>
                      <span>MVA</span>
                      <span>Sum</span>
                      {canEdit && <span></span>}
                    </div>
                    {lines.map(line => {
                      const lineTotal = (line.quantity || 0) * (line.unit_price || 0);
                      const isEditing = editingLine === line.id;

                      return (
                        <div key={line.id} className={styles.lineRow}>
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                className="form-input"
                                defaultValue={line.description}
                                onBlur={(e) => handleUpdateLine(line.id, { description: e.target.value })}
                                autoFocus
                              />
                              <input
                                type="number"
                                className="form-input"
                                defaultValue={line.quantity}
                                onBlur={(e) => handleUpdateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                              />
                              <input
                                type="number"
                                className="form-input"
                                defaultValue={line.unit_price}
                                onBlur={(e) => handleUpdateLine(line.id, { unit_price: parseFloat(e.target.value) || 0 })}
                              />
                              <input
                                type="number"
                                className="form-input"
                                defaultValue={line.vat_rate || 25}
                                onBlur={(e) => handleUpdateLine(line.id, { vat_rate: parseFloat(e.target.value) || 25 })}
                              />
                              <span>{formatCurrency(lineTotal)}</span>
                              <button 
                                className={styles.iconBtn}
                                onClick={() => setEditingLine(null)}
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span>{line.description}</span>
                              <span>{line.quantity} {line.unit_name}</span>
                              <span>{formatCurrency(line.unit_price)}</span>
                              <span>{line.vat_rate || 25}%</span>
                              <span className={styles.lineSum}>{formatCurrency(lineTotal)}</span>
                              {canEdit && (
                                <div className={styles.lineActions}>
                                  <button 
                                    className={styles.iconBtn}
                                    onClick={() => setEditingLine(line.id)}
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button 
                                    className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                    onClick={() => handleDeleteLine(line.id)}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile Cards */}
                <div className={styles.mobileLines}>
                  {lines.map(line => {
                    const lineTotal = (line.quantity || 0) * (line.unit_price || 0);
                    const isEditing = editingLine === line.id;

                    return (
                      <div key={line.id} className={`${styles.mobileLineCard} ${isEditing ? styles.editing : ''}`}>
                        {isEditing ? (
                          <>
                            <div className={styles.mobileLineHeader}>
                              <input
                                type="text"
                                className="form-input"
                                defaultValue={line.description}
                                placeholder="Beskrivelse"
                                onBlur={(e) => handleUpdateLine(line.id, { description: e.target.value })}
                              />
                              <button 
                                className={styles.iconBtn}
                                onClick={() => setEditingLine(null)}
                              >
                                <X size={18} />
                              </button>
                            </div>
                            <div className={styles.mobileLineGrid}>
                              <div className="form-group">
                                <label className="form-label">Antall</label>
                                <input
                                  type="number"
                                  className="form-input"
                                  defaultValue={line.quantity}
                                  onBlur={(e) => handleUpdateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Enhet</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  defaultValue={line.unit_name}
                                  onBlur={(e) => handleUpdateLine(line.id, { unit_name: e.target.value })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Pris</label>
                                <input
                                  type="number"
                                  className="form-input"
                                  defaultValue={line.unit_price}
                                  onBlur={(e) => handleUpdateLine(line.id, { unit_price: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">MVA %</label>
                                <input
                                  type="number"
                                  className="form-input"
                                  defaultValue={line.vat_rate || 25}
                                  onBlur={(e) => handleUpdateLine(line.id, { vat_rate: parseFloat(e.target.value) || 25 })}
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={styles.mobileLineHeader}>
                              <span className={styles.mobileLineTitle}>{line.description}</span>
                              {canEdit && (
                                <div className={styles.lineActions}>
                                  <button 
                                    className={styles.iconBtn}
                                    onClick={() => setEditingLine(line.id)}
                                  >
                                    <Edit size={18} />
                                  </button>
                                  <button 
                                    className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                    onClick={() => handleDeleteLine(line.id)}
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className={styles.mobileLineGrid}>
                              <div className={styles.mobileLineItem}>
                                <span className={styles.mobileLineLabel}>Antall</span>
                                <span className={styles.mobileLineValue}>{line.quantity} {line.unit_name}</span>
                              </div>
                              <div className={styles.mobileLineItem}>
                                <span className={styles.mobileLineLabel}>Pris</span>
                                <span className={styles.mobileLineValue}>{formatCurrency(line.unit_price)}</span>
                              </div>
                              <div className={styles.mobileLineItem}>
                                <span className={styles.mobileLineLabel}>MVA</span>
                                <span className={styles.mobileLineValue}>{line.vat_rate || 25}%</span>
                              </div>
                            </div>
                            <div className={styles.mobileLineFooter}>
                              <span className={styles.mobileLineSum}>{formatCurrency(lineTotal)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Totals */}
            <div className={styles.totals}>
              <div className={styles.totalRow}>
                <span>Sum eks. mva:</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>MVA:</span>
                <span>{formatCurrency(totals.vatAmount)}</span>
              </div>
              <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                <span>Å betale:</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment & Notes */}
          <div className={`card ${styles.card}`}>
            <h3 className={styles.cardTitle}>
              <Building size={18} />
              Betaling og vilkår
            </h3>
            
            <div className="form-group">
              <label className="form-label">KID / Betalingsreferanse</label>
              <input
                type="text"
                className="form-input"
                value={formData.payment_reference}
                onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                placeholder="Valgfri betalingsreferanse"
                disabled={!canEdit}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Betalingsvilkår</label>
              <textarea
                className="form-input"
                rows={2}
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                disabled={!canEdit}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notater</label>
              <textarea
                className="form-input"
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Interne notater (vises ikke på faktura)"
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>

        {/* Right Column - Preview */}
        <div className={styles.previewColumn}>
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <h3>Forhåndsvisning</h3>
              <button className="btn btn-secondary btn-sm">
                <Download size={16} />
                PDF
              </button>
            </div>
            <div className={styles.preview}>
              <div className={styles.invoicePreview}>
                <div className={styles.previewTop}>
                  <div>
                    <h2 className={styles.previewOrgName}>{organization?.name}</h2>
                    <p>{organization?.address}</p>
                    <p>{organization?.postal_code} {organization?.city}</p>
                    {organization?.organization_number && (
                      <p>Org.nr: {organization.organization_number}</p>
                    )}
                  </div>
                  <div className={styles.previewInvoiceInfo}>
                    <h1>FAKTURA</h1>
                    <p><strong>Fakturanr:</strong> {invoice?.invoice_number || 'NY'}</p>
                    <p><strong>Dato:</strong> {formData.invoice_date ? format(new Date(formData.invoice_date), 'd. MMM yyyy', { locale: nb }) : '-'}</p>
                    <p><strong>Forfall:</strong> {formData.due_date ? format(new Date(formData.due_date), 'd. MMM yyyy', { locale: nb }) : '-'}</p>
                  </div>
                </div>

                <div className={styles.previewCustomer}>
                  <strong>Faktureres til:</strong>
                  <p>{selectedCustomer?.name || 'Velg kunde'}</p>
                  {selectedCustomer?.address && <p>{selectedCustomer.address}</p>}
                  {(selectedCustomer?.postal_code || selectedCustomer?.city) && (
                    <p>{selectedCustomer.postal_code} {selectedCustomer.city}</p>
                  )}
                </div>

                {formData.title && (
                  <div className={styles.previewTitle}>
                    <strong>{formData.title}</strong>
                    {formData.description && <p>{formData.description}</p>}
                  </div>
                )}

                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th>Beskrivelse</th>
                      <th>Antall</th>
                      <th>Pris</th>
                      <th>MVA</th>
                      <th>Sum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(line => (
                      <tr key={line.id}>
                        <td>{line.description}</td>
                        <td>{line.quantity} {line.unit_name}</td>
                        <td>{formatCurrency(line.unit_price)}</td>
                        <td>{line.vat_rate || 25}%</td>
                        <td>{formatCurrency((line.quantity || 0) * (line.unit_price || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className={styles.previewTotals}>
                  <div><span>Sum eks. mva:</span> <span>{formatCurrency(totals.subtotal)}</span></div>
                  <div><span>MVA:</span> <span>{formatCurrency(totals.vatAmount)}</span></div>
                  <div className={styles.previewGrandTotal}>
                    <span>Å betale:</span> <span>{formatCurrency(totals.total)}</span>
                  </div>
                </div>

                <div className={styles.previewPayment}>
                  <p><strong>Betalingsinformasjon:</strong></p>
                  <p>Kontonummer: {organization?.bank_account || '[Sett opp i innstillinger]'}</p>
                  {formData.payment_reference && <p>KID: {formData.payment_reference}</p>}
                </div>

                {formData.terms && (
                  <div className={styles.previewTerms}>
                    <p>{formData.terms}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Line Modal */}
      {showAddLine && (
        <div className="modal-overlay" onClick={() => setShowAddLine(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Legg til linje</h3>
              <button className="modal-close" onClick={() => setShowAddLine(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Beskrivelse *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newLine.description}
                  onChange={(e) => setNewLine({ ...newLine, description: e.target.value })}
                  placeholder="Beskrivelse av vare/tjeneste"
                />
              </div>
              <div className={styles.lineFormRow}>
                <div className="form-group">
                  <label className="form-label">Antall</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newLine.quantity}
                    onChange={(e) => setNewLine({ ...newLine, quantity: parseFloat(e.target.value) || 1 })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Enhet</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newLine.unit_name}
                    onChange={(e) => setNewLine({ ...newLine, unit_name: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.lineFormRow}>
                <div className="form-group">
                  <label className="form-label">Pris per enhet (eks. mva)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newLine.unit_price}
                    onChange={(e) => setNewLine({ ...newLine, unit_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">MVA %</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newLine.vat_rate}
                    onChange={(e) => setNewLine({ ...newLine, vat_rate: parseFloat(e.target.value) || 25 })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddLine(false)}>
                Avbryt
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleAddLine}
                disabled={!newLine.description.trim()}
              >
                <Plus size={18} />
                Legg til
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Invoice Modal */}
      {sendModal && (
        <div className="modal-overlay" onClick={() => setSendModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Send faktura</h3>
              <button className="modal-close" onClick={() => setSendModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className={styles.sendModalContent}>
                <Mail size={48} strokeWidth={1.5} />
                <p>
                  Faktura #{invoice?.invoice_number} vil bli sendt til:
                </p>
                <strong>{selectedCustomer?.email}</strong>
                <p className={styles.sendModalNote}>
                  Fakturaen sendes som PDF-vedlegg på e-post.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSendModal(false)}>
                Avbryt
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSendEmail}
                disabled={sending}
              >
                <Send size={18} />
                {sending ? 'Sender...' : 'Send faktura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
