import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  Save,
  X,
  User,
  MapPin,
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  Package,
  Receipt
} from 'lucide-react';
import styles from './JobDetail.module.css';

const STATUS_MAP = {
  pending: { label: 'Venter', color: 'var(--color-warning)' },
  in_progress: { label: 'Pågår', color: 'var(--color-primary)' },
  completed: { label: 'Fullført', color: 'var(--color-success)' },
  cancelled: { label: 'Kansellert', color: 'var(--color-error)' }
};

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { organization, profile } = useAuth();
  
  const [job, setJob] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLine, setEditingLine] = useState(null);
  const [showAddLine, setShowAddLine] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [invoiceModal, setInvoiceModal] = useState(false);
  
  const [newLine, setNewLine] = useState({
    description: '',
    quantity: 1,
    unit_name: 'stk',
    unit_price: 0,
    cost_price: 0,
    vat_rate: 25
  });

  useEffect(() => {
    if (id && organization?.id) {
      fetchJob();
    }
  }, [id, organization]);

  const fetchJob = async () => {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*),
          quote:quotes(id, quote_number, title)
        `)
        .eq('id', id)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      // Fetch job lines
      const { data: linesData, error: linesError } = await supabase
        .from('job_lines')
        .select('*')
        .eq('job_id', id)
        .order('sort_order');

      if (linesError) throw linesError;
      setLines(linesData || []);
    } catch (error) {
      console.error('Error fetching job:', error);
      navigate('/jobber');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let vatAmount = 0;
    
    lines.forEach(line => {
      const lineTotal = line.quantity * line.unit_price;
      subtotal += lineTotal;
      vatAmount += lineTotal * ((line.vat_rate || 25) / 100);
    });

    return {
      subtotal,
      vatAmount,
      total: subtotal + vatAmount
    };
  };

  const handleAddLine = async () => {
    if (!newLine.description.trim()) return;
    
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('job_lines')
        .insert([{
          job_id: id,
          ...newLine,
          sort_order: lines.length
        }])
        .select()
        .single();

      if (error) throw error;
      
      setLines([...lines, data]);
      setNewLine({
        description: '',
        quantity: 1,
        unit_name: 'stk',
        unit_price: 0,
        cost_price: 0,
        vat_rate: 25
      });
      setShowAddLine(false);
    } catch (error) {
      console.error('Error adding line:', error);
      alert('Kunne ikke legge til linje. Prøv igjen.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLine = async (lineId, updates) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('job_lines')
        .update(updates)
        .eq('id', lineId);

      if (error) throw error;
      
      setLines(lines.map(l => l.id === lineId ? { ...l, ...updates } : l));
      setEditingLine(null);
    } catch (error) {
      console.error('Error updating line:', error);
      alert('Kunne ikke oppdatere linje. Prøv igjen.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLine = async (lineId) => {
    try {
      const { error } = await supabase
        .from('job_lines')
        .delete()
        .eq('id', lineId);

      if (error) throw error;
      
      setLines(lines.filter(l => l.id !== lineId));
      setDeleteModal(null);
    } catch (error) {
      console.error('Error deleting line:', error);
      alert('Kunne ikke slette linje. Prøv igjen.');
    }
  };

  const handleCreateInvoice = async (selectedLines) => {
    try {
      // Get next invoice number
      const { data: invoiceNum } = await supabase
        .rpc('get_next_invoice_number', { org_id: organization.id });

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          organization_id: organization.id,
          customer_id: job.customer_id,
          job_id: job.id,
          invoice_number: invoiceNum || 1,
          title: job.title,
          status: 'draft',
          due_date: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
          created_by: profile?.id
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice lines from selected job lines
      const invoiceLines = selectedLines.map((line, index) => ({
        invoice_id: invoice.id,
        job_line_id: line.id,
        article_id: line.article_id,
        description: line.description,
        quantity: line.quantityToInvoice || line.quantity - line.quantity_invoiced,
        unit_name: line.unit_name,
        cost_price: line.cost_price || 0,
        unit_price: line.unit_price,
        vat_rate: line.vat_rate || 25,
        total: (line.quantityToInvoice || line.quantity - line.quantity_invoiced) * line.unit_price,
        sort_order: index
      }));

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(invoiceLines);

      if (linesError) throw linesError;

      // Update quantity_invoiced on job_lines
      for (const line of selectedLines) {
        const newQuantityInvoiced = (line.quantity_invoiced || 0) + (line.quantityToInvoice || line.quantity - line.quantity_invoiced);
        await supabase
          .from('job_lines')
          .update({ quantity_invoiced: newQuantityInvoiced })
          .eq('id', line.id);
      }

      // Refresh job lines
      await fetchJob();
      setInvoiceModal(false);
      
      // Navigate to invoice
      navigate(`/fakturaer/${invoice.id}`);
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Kunne ikke opprette faktura. Prøv igjen.');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page-container">
        <p>Jobb ikke funnet</p>
      </div>
    );
  }

  const totals = calculateTotals();
  const status = STATUS_MAP[job.status] || STATUS_MAP.pending;
  const hasUninvoicedLines = lines.some(l => l.quantity > (l.quantity_invoiced || 0));

  return (
    <div className="page-container">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/jobber" className={styles.backButton}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className={styles.title}>{job.title}</h1>
            <div className={styles.meta}>
              <span 
                className={styles.statusBadge}
                style={{ backgroundColor: status.color }}
              >
                {status.label}
              </span>
              {job.quote && (
                <span className={styles.quoteRef}>
                  Fra tilbud #{job.quote.quote_number}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link to={`/jobber/${id}/rediger`} className="btn btn-secondary">
            <Edit size={18} />
            Rediger
          </Link>
          {hasUninvoicedLines && (
            <button 
              className="btn btn-primary"
              onClick={() => setInvoiceModal(true)}
            >
              <Receipt size={18} />
              Opprett faktura
            </button>
          )}
        </div>
      </div>

      <div className={styles.content}>
        {/* Job Info */}
        <div className={styles.infoGrid}>
          {/* Customer Card */}
          <div className={`card ${styles.infoCard}`}>
            <h3 className={styles.cardTitle}>
              <User size={18} />
              Kunde
            </h3>
            {job.customer ? (
              <div className={styles.customerInfo}>
                <p className={styles.customerName}>{job.customer.name}</p>
                {job.customer.email && <p>{job.customer.email}</p>}
                {job.customer.phone && <p>{job.customer.phone}</p>}
              </div>
            ) : (
              <p className={styles.noData}>Ingen kunde valgt</p>
            )}
          </div>

          {/* Location Card */}
          <div className={`card ${styles.infoCard}`}>
            <h3 className={styles.cardTitle}>
              <MapPin size={18} />
              Arbeidssted
            </h3>
            {job.address ? (
              <div>
                <p>{job.address}</p>
                {(job.postal_code || job.city) && (
                  <p>{job.postal_code} {job.city}</p>
                )}
              </div>
            ) : (
              <p className={styles.noData}>Ingen adresse</p>
            )}
          </div>

          {/* Schedule Card */}
          <div className={`card ${styles.infoCard}`}>
            <h3 className={styles.cardTitle}>
              <Calendar size={18} />
              Tidspunkt
            </h3>
            <div className={styles.scheduleInfo}>
              {job.start_date && (
                <p>
                  <strong>Start:</strong>{' '}
                  {format(new Date(job.start_date), 'd. MMMM yyyy', { locale: nb })}
                </p>
              )}
              {job.estimated_hours && (
                <p>
                  <strong>Estimert:</strong> {job.estimated_hours} timer
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {job.description && (
          <div className={`card ${styles.descriptionCard}`}>
            <h3 className={styles.cardTitle}>
              <FileText size={18} />
              Beskrivelse
            </h3>
            <p className={styles.description}>{job.description}</p>
          </div>
        )}

        {/* Job Lines */}
        <div className={`card ${styles.linesCard}`}>
          <div className={styles.linesHeader}>
            <h3 className={styles.cardTitle}>
              <Package size={18} />
              Arbeidslinjer
            </h3>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAddLine(true)}
            >
              <Plus size={16} />
              Legg til linje
            </button>
          </div>

          {lines.length === 0 ? (
            <p className={styles.noData}>Ingen linjer lagt til</p>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className={styles.desktopLinesTable}>
                <div className={styles.linesTable}>
                  <div className={styles.linesTableHeader}>
                    <span>Beskrivelse</span>
                    <span>Antall</span>
                    <span>Enhet</span>
                    <span>Pris</span>
                    <span>MVA</span>
                    <span>Sum</span>
                    <span>Fakturert</span>
                    <span></span>
                  </div>
                  {lines.map(line => {
                    const lineTotal = line.quantity * line.unit_price;
                    const remaining = line.quantity - (line.quantity_invoiced || 0);
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
                            />
                            <input
                              type="number"
                              className="form-input"
                              defaultValue={line.quantity}
                              onBlur={(e) => handleUpdateLine(line.id, { quantity: parseFloat(e.target.value) })}
                            />
                            <input
                              type="text"
                              className="form-input"
                              defaultValue={line.unit_name}
                              onBlur={(e) => handleUpdateLine(line.id, { unit_name: e.target.value })}
                            />
                            <input
                              type="number"
                              className="form-input"
                              defaultValue={line.unit_price}
                              onBlur={(e) => handleUpdateLine(line.id, { unit_price: parseFloat(e.target.value) })}
                            />
                            <input
                              type="number"
                              className="form-input"
                              defaultValue={line.vat_rate}
                              onBlur={(e) => handleUpdateLine(line.id, { vat_rate: parseFloat(e.target.value) })}
                            />
                            <span>{formatCurrency(lineTotal)}</span>
                            <span>{line.quantity_invoiced || 0} / {line.quantity}</span>
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
                            <span>{line.quantity}</span>
                            <span>{line.unit_name}</span>
                            <span>{formatCurrency(line.unit_price)}</span>
                            <span>{line.vat_rate || 25}%</span>
                            <span>{formatCurrency(lineTotal)}</span>
                            <span className={remaining === 0 ? styles.fullyInvoiced : ''}>
                              {line.quantity_invoiced || 0} / {line.quantity}
                              {remaining === 0 && <CheckCircle size={14} />}
                            </span>
                            <div className={styles.lineActions}>
                              <button 
                                className={styles.iconBtn}
                                onClick={() => setEditingLine(line.id)}
                              >
                                <Edit size={16} />
                              </button>
                              <button 
                                className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                onClick={() => setDeleteModal(line)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Card View */}
              <div className={styles.mobileLines}>
                {lines.map(line => {
                  const lineTotal = line.quantity * line.unit_price;
                  const remaining = line.quantity - (line.quantity_invoiced || 0);
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
                                onBlur={(e) => handleUpdateLine(line.id, { quantity: parseFloat(e.target.value) })}
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
                              <label className="form-label">Pris per enhet</label>
                              <input
                                type="number"
                                className="form-input"
                                defaultValue={line.unit_price}
                                onBlur={(e) => handleUpdateLine(line.id, { unit_price: parseFloat(e.target.value) })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">MVA %</label>
                              <input
                                type="number"
                                className="form-input"
                                defaultValue={line.vat_rate || 25}
                                onBlur={(e) => handleUpdateLine(line.id, { vat_rate: parseFloat(e.target.value) })}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={styles.mobileLineHeader}>
                            <span className={styles.mobileLineTitle}>{line.description}</span>
                            <div className={styles.lineActions}>
                              <button 
                                className={styles.iconBtn}
                                onClick={() => setEditingLine(line.id)}
                              >
                                <Edit size={18} />
                              </button>
                              <button 
                                className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                onClick={() => setDeleteModal(line)}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
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
                            <div className={styles.mobileLineItem}>
                              <span className={styles.mobileLineLabel}>Fakturert</span>
                              <span className={`${styles.mobileLineValue} ${remaining === 0 ? styles.complete : ''}`}>
                                {line.quantity_invoiced || 0} / {line.quantity}
                                {remaining === 0 && <CheckCircle size={14} />}
                              </span>
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
          {lines.length > 0 && (
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
                <span>Totalt:</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          )}
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
                  placeholder="Beskrivelse av arbeid/produkt"
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
                disabled={saving || !newLine.description.trim()}
              >
                <Plus size={18} />
                Legg til
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Line Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Slett linje</h3>
              <button className="modal-close" onClick={() => setDeleteModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Er du sikker på at du vil slette denne linjen?</p>
              <p><strong>{deleteModal.description}</strong></p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>
                Avbryt
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => handleDeleteLine(deleteModal.id)}
              >
                Slett
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {invoiceModal && (
        <InvoiceModal
          lines={lines}
          onClose={() => setInvoiceModal(false)}
          onCreateInvoice={handleCreateInvoice}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
}

// Invoice Modal Component
function InvoiceModal({ lines, onClose, onCreateInvoice, formatCurrency }) {
  const [selectedLines, setSelectedLines] = useState(
    lines.filter(l => l.quantity > (l.quantity_invoiced || 0)).map(l => ({
      ...l,
      quantityToInvoice: l.quantity - (l.quantity_invoiced || 0),
      selected: true
    }))
  );

  const toggleLine = (lineId) => {
    setSelectedLines(selectedLines.map(l => 
      l.id === lineId ? { ...l, selected: !l.selected } : l
    ));
  };

  const updateQuantity = (lineId, quantity) => {
    setSelectedLines(selectedLines.map(l => 
      l.id === lineId ? { ...l, quantityToInvoice: Math.min(quantity, l.quantity - (l.quantity_invoiced || 0)) } : l
    ));
  };

  const handleCreate = () => {
    const linesToInvoice = selectedLines.filter(l => l.selected && l.quantityToInvoice > 0);
    if (linesToInvoice.length === 0) {
      alert('Velg minst én linje å fakturere');
      return;
    }
    onCreateInvoice(linesToInvoice);
  };

  const total = selectedLines
    .filter(l => l.selected)
    .reduce((sum, l) => sum + (l.quantityToInvoice * l.unit_price * (1 + (l.vat_rate || 25) / 100)), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${styles.invoiceModal}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Opprett faktura</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <p className={styles.invoiceModalDesc}>
            Velg hvilke linjer du vil fakturere. Du kan delfakturere ved å endre antall.
          </p>
          
          <div className={styles.invoiceLinesList}>
            {selectedLines.map(line => {
              const maxQuantity = line.quantity - (line.quantity_invoiced || 0);
              return (
                <div key={line.id} className={styles.invoiceLine}>
                  <label className={styles.invoiceLineCheck}>
                    <input
                      type="checkbox"
                      checked={line.selected}
                      onChange={() => toggleLine(line.id)}
                    />
                    <span>{line.description}</span>
                  </label>
                  <div className={styles.invoiceLineDetails}>
                    <input
                      type="number"
                      className="form-input"
                      value={line.quantityToInvoice}
                      onChange={(e) => updateQuantity(line.id, parseFloat(e.target.value) || 0)}
                      min={0}
                      max={maxQuantity}
                      disabled={!line.selected}
                    />
                    <span>av {maxQuantity} {line.unit_name}</span>
                    <span className={styles.invoiceLinePrice}>
                      {formatCurrency(line.quantityToInvoice * line.unit_price)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.invoiceTotal}>
            <span>Total å fakturere (inkl. mva):</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn btn-primary" onClick={handleCreate}>
            <Receipt size={18} />
            Opprett faktura
          </button>
        </div>
      </div>
    </div>
  );
}
