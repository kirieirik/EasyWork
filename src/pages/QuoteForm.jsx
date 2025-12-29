import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { format, addDays } from 'date-fns';
import {
  ArrowLeft,
  Save,
  User,
  FileText,
  Plus,
  X,
  Search,
  Package,
  Calendar,
  Bookmark
} from 'lucide-react';
import DateInput from '../components/DateInput';
import styles from './QuoteForm.module.css';

const defaultLine = {
  article_number: '',
  description: '',
  quantity: 1,
  unit_name: 'stk',
  cost_price: 0,
  unit_price: 0,
  vat_percent: 25,
};

const UNIT_OPTIONS = [
  'stk',
  'timer',
  'm',
  'm²',
  'm³',
  'kg',
  'tonn',
  'lass',
  'liter',
  'pakke',
  'sett',
  'løpemeter',
  'par',
  'rull',
  'boks',
];

export default function QuoteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { organization } = useAuth();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'draft',
    valid_until: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  });
  
  // Customer search
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showQuickCreateCustomer, setShowQuickCreateCustomer] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: '', phone: '', email: '' });
  const customerSearchRef = useRef(null);

  // Quote lines
  const [lines, setLines] = useState([{ ...defaultLine }]);
  
  // Articles
  const [articles, setArticles] = useState([]);
  const [articleSearch, setArticleSearch] = useState({});
  const [showArticleDropdown, setShowArticleDropdown] = useState({});

  useEffect(() => {
    if (organization?.id) {
      fetchCustomers();
      fetchArticles();
      if (isEditing) {
        fetchQuote();
      }
    }
  }, [organization, id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('organization_id', organization.id)
      .order('name');
    setCustomers(data || []);
  };

  const fetchArticles = async () => {
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('organization_id', organization.id)
      .order('name');
    setArticles(data || []);
  };

  const fetchQuote = async () => {
    setLoading(true);
    try {
      const { data: quote, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(*),
          lines:quote_lines(*, article:articles(article_number))
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      setFormData({
        title: quote.title || '',
        description: quote.description || '',
        status: quote.status || 'draft',
        valid_until: quote.valid_until || format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      });

      if (quote.customer) {
        setSelectedCustomer(quote.customer);
      }

      if (quote.lines && quote.lines.length > 0) {
        setLines(quote.lines.map(line => ({
          id: line.id,
          article_id: line.article_id || null,
          article_number: line.article?.article_number || '',
          description: line.description || '',
          quantity: line.quantity || 1,
          cost_price: line.cost_price || 0,
          unit_price: line.unit_price || 0,
          vat_percent: line.vat_rate || 25,
        })));
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
      navigate('/tilbud');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  };

  const createQuickCustomer = async () => {
    if (!quickCustomer.name.trim()) return;

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          organization_id: organization.id,
          name: quickCustomer.name.trim(),
          phone: quickCustomer.phone.trim() || null,
          email: quickCustomer.email.trim() || null,
        }])
        .select()
        .single();

      if (error) throw error;

      setCustomers([...customers, data]);
      setSelectedCustomer(data);
      setQuickCustomer({ name: '', phone: '', email: '' });
      setShowQuickCreateCustomer(false);
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Kunne ikke opprette kunde. Prøv igjen.');
    }
  };

  const addLine = () => {
    setLines([...lines, { ...defaultLine }]);
  };

  const updateLine = (index, field, value) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const removeLine = (index) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  // Keyboard navigation between input fields
  const handleKeyNavigation = (e, rowIndex, fieldName) => {
    const fields = ['article_number', 'quantity', 'cost_price', 'unit_price'];
    const currentFieldIndex = fields.indexOf(fieldName);
    
    if (e.key === 'ArrowLeft' && currentFieldIndex > 0) {
      e.preventDefault();
      const prevField = fields[currentFieldIndex - 1];
      const input = document.querySelector(`[data-row="${rowIndex}"][data-field="${prevField}"]`);
      if (input) {
        input.focus();
        input.select();
      }
    } else if (e.key === 'ArrowRight' && currentFieldIndex < fields.length - 1) {
      e.preventDefault();
      const nextField = fields[currentFieldIndex + 1];
      const input = document.querySelector(`[data-row="${rowIndex}"][data-field="${nextField}"]`);
      if (input) {
        input.focus();
        input.select();
      }
    } else if (e.key === 'ArrowDown' && rowIndex < lines.length - 1) {
      e.preventDefault();
      const input = document.querySelector(`[data-row="${rowIndex + 1}"][data-field="${fieldName}"]`);
      if (input) {
        input.focus();
        input.select();
      }
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      const input = document.querySelector(`[data-row="${rowIndex - 1}"][data-field="${fieldName}"]`);
      if (input) {
        input.focus();
        input.select();
      }
    } else if (e.key === 'Tab' && !e.shiftKey && currentFieldIndex === fields.length - 1) {
      // Tab from last field goes to next row's first field
      if (rowIndex < lines.length - 1) {
        e.preventDefault();
        const input = document.querySelector(`[data-row="${rowIndex + 1}"][data-field="${fields[0]}"]`);
        if (input) {
          input.focus();
          input.select();
        }
      }
    }
  };

  const selectArticle = (index, article) => {
    const newLines = [...lines];
    newLines[index] = {
      ...newLines[index],
      article_id: article.id,
      article_number: article.article_number || '',
      description: article.name,
      unit_name: article.unit_name || 'stk',
      cost_price: article.cost_price || 0,
      unit_price: article.sale_price || 0,
    };
    setLines(newLines);
    // Remove the search key entirely so the input shows line.description
    const newArticleSearch = { ...articleSearch };
    delete newArticleSearch[index];
    setArticleSearch(newArticleSearch);
    setShowArticleDropdown({ ...showArticleDropdown, [index]: false });
  };

  const saveLineAsArticle = async (line) => {
    if (!line.description?.trim()) {
      alert('Artikkelen må ha en beskrivelse/navn');
      return;
    }

    try {
      // Check if article with same name already exists
      const { data: existing } = await supabase
        .from('articles')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('name', line.description.trim())
        .single();

      if (existing) {
        // Update existing article
        const { error } = await supabase
          .from('articles')
          .update({
            article_number: line.article_number || null,
            cost_price: line.cost_price || 0,
            sale_price: line.unit_price || 0,
            vat_rate: line.vat_percent || 25,
          })
          .eq('id', existing.id);

        if (error) throw error;
        
        // Update local articles list
        setArticles(articles.map(a => 
          a.id === existing.id 
            ? { ...a, article_number: line.article_number || null, cost_price: line.cost_price || 0, sale_price: line.unit_price || 0, vat_rate: line.vat_percent || 25 }
            : a
        ));
        
        alert(`Artikkel "${line.description}" er oppdatert!`);
      } else {
        // Create new article
        const { data, error } = await supabase
          .from('articles')
          .insert([{
            organization_id: organization.id,
            article_number: line.article_number || null,
            name: line.description.trim(),
            cost_price: line.cost_price || 0,
            sale_price: line.unit_price || 0,
            vat_rate: line.vat_percent || 25,
          }])
          .select()
          .single();

        if (error) throw error;
        
        // Add to local articles list
        setArticles([...articles, data]);
        
        alert(`Artikkel "${line.description}" er lagret!`);
      }
    } catch (error) {
      console.error('Error saving article:', error);
      alert('Kunne ikke lagre artikkel. Prøv igjen.');
    }
  };

  const calculateLineTotal = (line) => {
    const subtotal = (line.quantity || 0) * (line.unit_price || 0);
    const vat = subtotal * ((line.vat_percent || 0) / 100);
    return subtotal + vat;
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalVat = 0;
    let totalCost = 0;
    
    lines.forEach(line => {
      const lineSubtotal = (line.quantity || 0) * (line.unit_price || 0);
      const lineCost = (line.quantity || 0) * (line.cost_price || 0);
      const lineVat = lineSubtotal * ((line.vat_percent || 0) / 100);
      subtotal += lineSubtotal;
      totalVat += lineVat;
      totalCost += lineCost;
    });

    return {
      subtotal,
      vat: totalVat,
      total: subtotal + totalVat,
      cost: totalCost,
      profit: subtotal - totalCost,
      margin: subtotal > 0 ? ((subtotal - totalCost) / subtotal) * 100 : 0
    };
  };

  const calculateLineProfit = (line) => {
    const revenue = (line.quantity || 0) * (line.unit_price || 0);
    const cost = (line.quantity || 0) * (line.cost_price || 0);
    return revenue - cost;
  };

  const calculateLineMargin = (line) => {
    const revenue = (line.quantity || 0) * (line.unit_price || 0);
    const cost = (line.quantity || 0) * (line.cost_price || 0);
    if (revenue === 0) return 0;
    return ((revenue - cost) / revenue) * 100;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Vennligst fyll inn tittel');
      return;
    }

    setSaving(true);
    try {
      const totals = calculateTotals();
      const quoteData = {
        organization_id: organization.id,
        customer_id: selectedCustomer?.id || null,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        valid_until: formData.valid_until || null,
        subtotal: totals.subtotal,
        vat_amount: totals.vat,
        total: totals.total,
      };

      let quoteId = id;

      if (isEditing) {
        const { error } = await supabase
          .from('quotes')
          .update(quoteData)
          .eq('id', id);
        if (error) throw error;

        // Delete old lines and insert new
        await supabase.from('quote_lines').delete().eq('quote_id', id);
      } else {
        // quote_number is auto-generated by the database (serial)
        const { data, error } = await supabase
          .from('quotes')
          .insert([quoteData])
          .select()
          .single();
        if (error) throw error;
        quoteId = data.id;
      }

      // Insert lines
      if (lines.length > 0 && quoteId) {
        const lineData = lines
          .filter(line => line.description.trim())
          .map((line, index) => ({
            quote_id: quoteId,
            sort_order: index,
            article_id: line.article_id || null,
            description: line.description.trim(),
            quantity: line.quantity || 1,
            cost_price: line.cost_price || 0,
            unit_price: line.unit_price || 0,
            vat_rate: line.vat_percent || 25,
            total: calculateLineTotal(line),
          }));

        if (lineData.length > 0) {
          const { error } = await supabase
            .from('quote_lines')
            .insert(lineData);
          if (error) throw error;
        }
      }

      navigate('/tilbud');
    } catch (error) {
      console.error('Error saving quote:', error);
      alert('Kunne ikke lagre tilbud. Prøv igjen.');
    } finally {
      setSaving(false);
    }
  };

  const totals = calculateTotals();

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
      <div className="page-header" style={{ marginBottom: 'var(--space-lg)' }}>
        <Link to="/tilbud" className="btn btn-ghost">
          <ArrowLeft size={18} />
          Tilbake
        </Link>
        <h1 className="page-title">
          {isEditing ? 'Rediger tilbud' : 'Nytt tilbud'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Customer Section */}
        <div className={styles.formCard}>
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>
              <User size={18} />
              Kunde
            </h3>
            
            {selectedCustomer ? (
              <div className={styles.selectedCustomer}>
                <div className={styles.selectedCustomerInfo}>
                  <User size={16} className="text-muted" />
                  <span className={styles.selectedCustomerName}>{selectedCustomer.name}</span>
                  {(selectedCustomer.email || selectedCustomer.phone) && (
                    <span className={styles.selectedCustomerDetails}>
                      {selectedCustomer.email} {selectedCustomer.phone && `• ${selectedCustomer.phone}`}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.clearCustomerBtn}
                  onClick={() => setSelectedCustomer(null)}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className={styles.customerSearch} ref={customerSearchRef}>
                <div className="search-input-wrapper">
                  <Search size={18} />
                  <input
                    type="text"
                    className="form-input search-input"
                    placeholder="Søk etter kunde..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                  />
                </div>
                
                {showCustomerDropdown && (
                  <div className={styles.customerDropdown}>
                    {filteredCustomers.slice(0, 5).map((customer) => (
                      <div
                        key={customer.id}
                        className={styles.customerOption}
                        onClick={() => handleCustomerSelect(customer)}
                      >
                        <User size={14} className="text-muted" />
                        <div>
                          <div className={styles.customerOptionName}>{customer.name}</div>
                          {customer.email && (
                            <div className={styles.customerOptionEmail}>{customer.email}</div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div
                      className={`${styles.customerOption} ${styles.customerOptionCreate}`}
                      onClick={() => {
                        setQuickCustomer({ ...quickCustomer, name: customerSearch });
                        setShowQuickCreateCustomer(true);
                        setShowCustomerDropdown(false);
                      }}
                    >
                      <Plus size={14} />
                      <span>Opprett ny kunde</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quote Details */}
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>
              <FileText size={18} />
              Tilbudsdetaljer
            </h3>
            
            <div className={styles.formRow}>
              <div className="form-group">
                <label className="form-label">Tittel *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="F.eks. Maling av stue"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Gyldig til</label>
                <DateInput
                  name="valid_until"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
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
              />
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <div className={styles.statusOptions}>
                {[
                  { value: 'draft', label: 'Utkast' },
                  { value: 'pending', label: 'Sendt' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.statusOption} ${formData.status === option.value ? styles.active : ''}`}
                    onClick={() => setFormData({ ...formData, status: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quote Lines */}
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>
              <Package size={18} />
              Artikler / Linjer
            </h3>

            <div className={styles.linesTableWrapper}>
            <table className={styles.linesTable}>
              <thead>
                <tr>
                  <th className={styles.articleNumCol}>Art.nr</th>
                  <th className={styles.descriptionCol}>Beskrivelse</th>
                  <th className={styles.qtyCol}>Antall</th>
                  <th className={styles.unitCol}>Enhet</th>
                  <th className={styles.costCol}>Kostpris</th>
                  <th className={styles.priceCol}>Pris</th>
                  <th className={styles.profitCol}>Fortjeneste</th>
                  <th className={styles.marginCol}>DG %</th>
                  <th className={styles.vatCol}>MVA %</th>
                  <th className={styles.sumCol}>Sum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td className={styles.articlePicker}>
                      <input
                        type="text"
                        className={styles.lineInput}
                        value={line.article_number || ''}
                        onChange={(e) => {
                          updateLine(index, 'article_number', e.target.value);
                          setShowArticleDropdown({ ...showArticleDropdown, [index]: true });
                        }}
                        onFocus={() => setShowArticleDropdown({ ...showArticleDropdown, [index]: true })}
                        onBlur={() => setTimeout(() => setShowArticleDropdown({ ...showArticleDropdown, [index]: false }), 200)}
                        onKeyDown={(e) => handleKeyNavigation(e, index, 'article_number')}
                        data-row={index}
                        data-field="article_number"
                        placeholder=""
                      />
                      {showArticleDropdown[index] && articles.length > 0 && line.article_number && (
                        <div className={styles.articleDropdown}>
                          {articles
                            .filter(a => a.article_number?.toLowerCase().includes(line.article_number?.toLowerCase() || ''))
                            .slice(0, 5)
                            .map((article) => (
                              <div
                                key={article.id}
                                className={styles.articleOption}
                                onMouseDown={() => selectArticle(index, article)}
                              >
                                <div className={styles.articleNumber}>{article.article_number}</div>
                                <div className={styles.articleName}>{article.name}</div>
                                {article.sale_price && (
                                  <div className={styles.articlePrice}>{formatCurrency(article.sale_price)}</div>
                                )}
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </td>
                    <td className={styles.articlePicker}>
                      <input
                        type="text"
                        className={styles.lineInput}
                        value={articleSearch[index] !== undefined ? articleSearch[index] : line.description}
                        onChange={(e) => {
                          setArticleSearch({ ...articleSearch, [index]: e.target.value });
                          updateLine(index, 'description', e.target.value);
                          setShowArticleDropdown({ ...showArticleDropdown, [index]: true });
                        }}
                        onFocus={() => setShowArticleDropdown({ ...showArticleDropdown, [index]: true })}
                        onBlur={() => setTimeout(() => setShowArticleDropdown({ ...showArticleDropdown, [index]: false }), 200)}
                        placeholder="Skriv eller velg artikkel..."
                      />
                      {showArticleDropdown[index] && articles.length > 0 && (
                        <div className={styles.articleDropdown}>
                          {articles
                            .filter(a => a.name.toLowerCase().includes(line.description?.toLowerCase() || ''))
                            .slice(0, 5)
                            .map((article) => (
                              <div
                                key={article.id}
                                className={styles.articleOption}
                                onMouseDown={() => selectArticle(index, article)}
                              >
                                <div className={styles.articleName}>{article.name}</div>
                                {article.sale_price && (
                                  <div className={styles.articlePrice}>{formatCurrency(article.sale_price)}</div>
                                )}
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        className={styles.lineInputSmall}
                        value={line.quantity || ''}
                        onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => handleKeyNavigation(e, index, 'quantity')}
                        data-row={index}
                        data-field="quantity"
                        min="0"
                        step="0.5"
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <select
                        className={styles.lineInputSmall}
                        value={line.unit_name || 'stk'}
                        onChange={(e) => updateLine(index, 'unit_name', e.target.value)}
                      >
                        {UNIT_OPTIONS.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        className={styles.lineInputSmall}
                        value={line.cost_price || ''}
                        onChange={(e) => updateLine(index, 'cost_price', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => handleKeyNavigation(e, index, 'cost_price')}
                        data-row={index}
                        data-field="cost_price"
                        min="0"
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className={styles.lineInputSmall}
                        value={line.unit_price || ''}
                        onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => handleKeyNavigation(e, index, 'unit_price')}
                        data-row={index}
                        data-field="unit_price"
                        min="0"
                        placeholder="0"
                      />
                    </td>
                    <td className={`${styles.lineProfit} ${calculateLineProfit(line) >= 0 ? styles.profitPositive : styles.profitNegative}`}>
                      {formatCurrency(calculateLineProfit(line))}
                    </td>
                    <td className={`${styles.lineMargin} ${calculateLineMargin(line) >= 0 ? styles.profitPositive : styles.profitNegative}`}>
                      {calculateLineMargin(line).toFixed(1)}%
                    </td>
                    <td>
                      <select
                        className={styles.lineInput}
                        value={line.vat_percent}
                        onChange={(e) => updateLine(index, 'vat_percent', parseFloat(e.target.value))}
                      >
                        <option value={0}>0%</option>
                        <option value={12}>12%</option>
                        <option value={15}>15%</option>
                        <option value={25}>25%</option>
                      </select>
                    </td>
                    <td className={styles.lineSum}>
                      {formatCurrency(calculateLineTotal(line))}
                    </td>
                    <td className={styles.lineActions}>
                      <button
                        type="button"
                        className={styles.saveArticleBtn}
                        onClick={() => saveLineAsArticle(line)}
                        title="Lagre som artikkel"
                        disabled={!line.description?.trim()}
                      >
                        <Bookmark size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.removeLineBtn}
                        onClick={() => removeLine(index)}
                        disabled={lines.length === 1}
                        title="Fjern linje"
                      >
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              type="button"
              className={styles.addLineBtn}
              onClick={addLine}
            >
              <Plus size={16} />
              Legg til linje
            </button>
            </div>

            {/* Mobile Line Cards */}
            <div className={styles.mobileLineCards}>
              {lines.map((line, index) => (
                <div key={index} className={styles.mobileLineCard}>
                  <div className={styles.mobileLineHeader}>
                    <div className={styles.mobileLineTitle}>
                      <input
                        type="text"
                        value={articleSearch[index] !== undefined ? articleSearch[index] : line.description}
                        onChange={(e) => {
                          setArticleSearch({ ...articleSearch, [index]: e.target.value });
                          updateLine(index, 'description', e.target.value);
                        }}
                        placeholder="Beskrivelse..."
                      />
                      <div className={styles.mobileLineArticleNum}>
                        <input
                          type="text"
                          value={line.article_number || ''}
                          onChange={(e) => updateLine(index, 'article_number', e.target.value)}
                          placeholder="Art.nr"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.mobileLineDelete}
                      onClick={() => removeLine(index)}
                      disabled={lines.length === 1}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className={styles.mobileLineGrid}>
                    <div className={styles.mobileLineField}>
                      <span className={styles.mobileLineLabel}>Antall</span>
                      <div className={styles.mobileLineValue}>
                        <input
                          type="number"
                          value={line.quantity || ''}
                          onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className={styles.mobileLineField}>
                      <span className={styles.mobileLineLabel}>Enhet</span>
                      <div className={styles.mobileLineValue}>
                        <select
                          value={line.unit_name || 'stk'}
                          onChange={(e) => updateLine(index, 'unit_name', e.target.value)}
                        >
                          {UNIT_OPTIONS.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className={styles.mobileLineField}>
                      <span className={styles.mobileLineLabel}>Kostpris</span>
                      <div className={styles.mobileLineValue}>
                        <input
                          type="number"
                          value={line.cost_price || ''}
                          onChange={(e) => updateLine(index, 'cost_price', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className={styles.mobileLineField}>
                      <span className={styles.mobileLineLabel}>Pris</span>
                      <div className={styles.mobileLineValue}>
                        <input
                          type="number"
                          value={line.unit_price || ''}
                          onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className={styles.mobileLineField}>
                      <span className={styles.mobileLineLabel}>MVA %</span>
                      <div className={styles.mobileLineValue}>
                        <select
                          value={line.vat_percent}
                          onChange={(e) => updateLine(index, 'vat_percent', parseFloat(e.target.value))}
                        >
                          <option value={0}>0%</option>
                          <option value={12}>12%</option>
                          <option value={15}>15%</option>
                          <option value={25}>25%</option>
                        </select>
                      </div>
                    </div>
                    <div className={styles.mobileLineField}>
                      <span className={styles.mobileLineLabel}>DG %</span>
                      <div className={`${styles.mobileLineMargin} ${calculateLineMargin(line) >= 0 ? styles.positive : styles.negative}`}>
                        {calculateLineMargin(line).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className={styles.mobileLineSummary}>
                    <span className={`${styles.mobileLineMargin} ${calculateLineProfit(line) >= 0 ? styles.positive : styles.negative}`}>
                      Fortjeneste: {formatCurrency(calculateLineProfit(line))}
                    </span>
                    <span className={styles.mobileLineTotal}>
                      {formatCurrency(calculateLineTotal(line))}
                    </span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className={styles.addLineBtn}
                onClick={addLine}
              >
                <Plus size={16} />
                Legg til linje
              </button>
            </div>

            {/* Totals */}
            <div className={styles.totalsSection}>
              <div className={styles.totalsTable}>
                <div className={styles.totalsRow}>
                  <span className={styles.totalsLabel}>Subtotal eks. mva</span>
                  <span className={styles.totalsValue}>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className={styles.totalsRow}>
                  <span className={styles.totalsLabel}>MVA</span>
                  <span className={styles.totalsValue}>{formatCurrency(totals.vat)}</span>
                </div>
                <div className={`${styles.totalsRow} ${styles.total}`}>
                  <span className={styles.totalsLabel}>Totalt inkl. mva</span>
                  <span className={styles.totalsValue}>{formatCurrency(totals.total)}</span>
                </div>
                <div className={`${styles.totalsRow} ${styles.profitRow}`}>
                  <span className={styles.totalsLabel}>Fortjeneste eks. mva</span>
                  <span className={`${styles.totalsValue} ${totals.profit >= 0 ? styles.profitPositive : styles.profitNegative}`}>
                    {formatCurrency(totals.profit)}
                  </span>
                </div>
                <div className={styles.totalsRow}>
                  <span className={styles.totalsLabel}>Dekningsgrad</span>
                  <span className={`${styles.totalsValue} ${totals.margin >= 0 ? styles.profitPositive : styles.profitNegative}`}>
                    {totals.margin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className={styles.formActions}>
            <Link to="/tilbud" className="btn btn-secondary">
              Avbryt
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              <Save size={18} />
              {saving ? 'Lagrer...' : (isEditing ? 'Oppdater tilbud' : 'Opprett tilbud')}
            </button>
          </div>
        </div>
      </form>

      {/* Quick Create Customer Modal */}
      {showQuickCreateCustomer && (
        <div className="modal-overlay" onClick={() => setShowQuickCreateCustomer(false)}>
          <div className={`modal ${styles.quickCreateModal}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Opprett ny kunde</h3>
              <button className="modal-close" onClick={() => setShowQuickCreateCustomer(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className={styles.quickCreateFields}>
                <div className="form-group">
                  <label className="form-label">Navn *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={quickCustomer.name}
                    onChange={(e) => setQuickCustomer({ ...quickCustomer, name: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={quickCustomer.phone}
                    onChange={(e) => setQuickCustomer({ ...quickCustomer, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">E-post</label>
                  <input
                    type="email"
                    className="form-input"
                    value={quickCustomer.email}
                    onChange={(e) => setQuickCustomer({ ...quickCustomer, email: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowQuickCreateCustomer(false)}
              >
                Avbryt
              </button>
              <button
                className="btn btn-primary"
                onClick={createQuickCustomer}
                disabled={!quickCustomer.name.trim()}
              >
                <Plus size={16} />
                Opprett kunde
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
