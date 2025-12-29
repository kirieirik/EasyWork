import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  Search,
  User,
  Plus,
  X,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import DateInput from '../components/DateInput';
import styles from './JobForm.module.css';

export default function JobForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { organization } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEditing);
  const [error, setError] = useState('');
  
  // Customer search state
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const customerSearchRef = useRef(null);
  
  // Quick create customer modal
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateData, setQuickCreateData] = useState({
    name: '',
    phone: '',
    email: ''
  });
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'in_progress',
    address: '',
    postal_code: '',
    city: '',
    start_date: searchParams.get('date') || '',
    end_date: '',
    estimated_hours: ''
  });

  useEffect(() => {
    fetchCustomers();
    if (isEditing) {
      fetchJob();
    }
  }, [id, organization]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCustomers = async () => {
    if (!organization?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone, address, is_private')
        .eq('organization_id', organization.id)
        .order('name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchJob = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(id, name, email, phone, address, is_private)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setFormData({
        title: data.title || '',
        description: data.description || '',
        status: data.status || 'in_progress',
        address: data.address || '',
        postal_code: data.postal_code || '',
        city: data.city || '',
        start_date: data.start_date || '',
        end_date: data.end_date || '',
        estimated_hours: data.estimated_hours || ''
      });
      
      if (data.customer) {
        setSelectedCustomer(data.customer);
      }
    } catch (error) {
      console.error('Error fetching job:', error);
      setError('Kunne ikke hente jobb');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleCustomerSearch = (value) => {
    setCustomerSearch(value);
    setShowCustomerDropdown(true);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.phone?.includes(customerSearch)
  );

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
    
    // Auto-fill address if customer has one and job doesn't
    if (customer.address && !formData.address) {
      setFormData(prev => ({
        ...prev,
        address: customer.address || ''
      }));
    }
  };

  const removeCustomer = () => {
    setSelectedCustomer(null);
  };

  const openQuickCreate = () => {
    setQuickCreateData({
      name: customerSearch,
      phone: '',
      email: ''
    });
    setShowQuickCreate(true);
    setShowCustomerDropdown(false);
  };

  const handleQuickCreate = async () => {
    if (!quickCreateData.name.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          organization_id: organization.id,
          name: quickCreateData.name.trim(),
          phone: quickCreateData.phone || null,
          email: quickCreateData.email || null,
          is_private: true // Default to private for quick-created customers
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Add to local list and select
      setCustomers(prev => [...prev, data]);
      setSelectedCustomer(data);
      setShowQuickCreate(false);
      setCustomerSearch('');
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Kunne ikke opprette kunde. Prøv igjen.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const jobData = {
        ...formData,
        organization_id: organization.id,
        customer_id: selectedCustomer?.id || null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null
      };

      if (isEditing) {
        const { error } = await supabase
          .from('jobs')
          .update(jobData)
          .eq('id', id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('jobs')
          .insert([jobData]);

        if (error) throw error;
      }

      navigate('/jobber');
    } catch (error) {
      console.error('Error saving job:', error);
      setError('Kunne ikke lagre jobb. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
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
        <Link to="/jobber" className={`btn btn-ghost btn-sm ${styles.backButton}`}>
          <ArrowLeft size={16} />
          Tilbake til jobber
        </Link>
        <h2 className={styles.title}>
          {isEditing ? 'Rediger jobb' : 'Ny jobb'}
        </h2>
      </div>

      {error && (
        <div className={`badge badge-danger ${styles.errorAlert}`}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Customer Section */}
        <div className={`card ${styles.card}`}>
          <h3 className={`card-title ${styles.cardTitle}`}>Kunde</h3>
          
          {!selectedCustomer ? (
            <div className={styles.customerSearch} ref={customerSearchRef}>
              <div className={styles.customerSearchInput}>
                <Search size={18} className={styles.customerSearchIcon} />
                <input
                  type="text"
                  className={`form-input ${styles.customerSearchField}`}
                  placeholder="Søk etter kunde eller skriv inn nytt navn..."
                  value={customerSearch}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                />
              </div>
              
              {showCustomerDropdown && customerSearch && (
                <div className={styles.customerDropdown}>
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.slice(0, 5).map(customer => (
                      <div
                        key={customer.id}
                        className={styles.customerOption}
                        onClick={() => selectCustomer(customer)}
                      >
                        <div className={styles.customerOptionName}>{customer.name}</div>
                        <div className={styles.customerOptionMeta}>
                          {customer.phone && (
                            <span className={styles.customerOptionMetaItem}>
                              <Phone size={10} /> {customer.phone}
                            </span>
                          )}
                          {customer.email && (
                            <span className={styles.customerOptionMetaItem}>
                              <Mail size={10} /> {customer.email}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : null}
                  
                  <div
                    className={styles.createCustomerOption}
                    onClick={openQuickCreate}
                  >
                    <Plus size={16} />
                    Opprett "{customerSearch}" som ny kunde
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.selectedCustomer}>
              <div className={styles.selectedCustomerInfo}>
                <div className={styles.selectedCustomerIcon}>
                  <User size={18} />
                </div>
                <div>
                  <div className={styles.selectedCustomerName}>{selectedCustomer.name}</div>
                  <div className={styles.selectedCustomerMeta}>
                    {selectedCustomer.phone || selectedCustomer.email || 'Ingen kontaktinfo'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={styles.removeCustomerBtn}
                onClick={removeCustomer}
                title="Fjern kunde"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Job Details */}
        <div className={`card ${styles.card}`}>
          <h3 className={`card-title ${styles.cardTitle}`}>Jobbdetaljer</h3>
          
          <div className="form-group">
            <label className="form-label" htmlFor="title">Jobbtittel *</label>
            <input
              id="title"
              name="title"
              type="text"
              className="form-input"
              placeholder="F.eks. Baderomsrenovering, Malejobb, Reparasjon..."
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Beskrivelse</label>
            <textarea
              id="description"
              name="description"
              className="form-textarea"
              placeholder="Beskriv jobben..."
              value={formData.description}
              onChange={handleChange}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <div className={styles.statusSelect}>
              <button
                type="button"
                className={`${styles.statusOption} ${formData.status === 'quote' ? styles.statusOptionQuote : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, status: 'quote' }))}
              >
                Tilbud
              </button>
              <button
                type="button"
                className={`${styles.statusOption} ${formData.status === 'in_progress' ? styles.statusOptionInProgress : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, status: 'in_progress' }))}
              >
                Pågår
              </button>
              <button
                type="button"
                className={`${styles.statusOption} ${formData.status === 'completed' ? styles.statusOptionCompleted : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, status: 'completed' }))}
              >
                Fullført
              </button>
            </div>
          </div>

          <div className={styles.dateRow}>
            <div className="form-group">
              <label className="form-label" htmlFor="start_date">Planlagt dato</label>
              <DateInput
                id="start_date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="estimated_hours">Estimerte timer</label>
              <input
                id="estimated_hours"
                name="estimated_hours"
                type="number"
                step="0.5"
                className="form-input"
                placeholder="F.eks. 8"
                value={formData.estimated_hours}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className={`card ${styles.card}`}>
          <h3 className={`card-title ${styles.cardTitle}`}>Arbeidssted</h3>
          
          <div className="form-group">
            <label className="form-label" htmlFor="address">Adresse</label>
            <input
              id="address"
              name="address"
              type="text"
              className="form-input"
              placeholder="Gateadresse"
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="postal_code">Postnummer</label>
              <input
                id="postal_code"
                name="postal_code"
                type="text"
                className="form-input"
                placeholder="0000"
                value={formData.postal_code}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="city">Sted</label>
              <input
                id="city"
                name="city"
                type="text"
                className="form-input"
                placeholder="Oslo"
                value={formData.city}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className={styles.buttonRow}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            ) : (
              <>
                <Save size={18} />
                {isEditing ? 'Lagre endringer' : 'Opprett jobb'}
              </>
            )}
          </button>
          <Link to="/jobber" className="btn btn-secondary">
            Avbryt
          </Link>
        </div>
      </form>

      {/* Quick Create Customer Modal */}
      {showQuickCreate && (
        <div className="modal-overlay" onClick={() => setShowQuickCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Hurtigopprett kunde</h3>
              <button className="modal-close" onClick={() => setShowQuickCreate(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className={styles.quickCreateForm}>
                <div className="form-group">
                  <label className="form-label">Kundenavn *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={quickCreateData.name}
                    onChange={(e) => setQuickCreateData(prev => ({ ...prev, name: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className={styles.quickCreateRow}>
                  <div className="form-group">
                    <label className="form-label">Telefon</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+47 123 45 678"
                      value={quickCreateData.phone}
                      onChange={(e) => setQuickCreateData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-post</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="kunde@eksempel.no"
                      value={quickCreateData.email}
                      onChange={(e) => setQuickCreateData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <p className="text-muted mt-md" style={{ fontSize: 'var(--font-size-sm)' }}>
                Du kan legge til mer informasjon senere via kundelisten.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowQuickCreate(false)}
              >
                Avbryt
              </button>
              <button
                className="btn btn-primary"
                onClick={handleQuickCreate}
                disabled={!quickCreateData.name.trim()}
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
