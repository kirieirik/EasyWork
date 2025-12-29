import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  Save,
  AlertCircle
} from 'lucide-react';
import styles from './CustomerForm.module.css';

export default function CustomerForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { organization } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEditing);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
    org_number: '',
    contact_person: '',
    notes: '',
    is_private: false
  });

  useEffect(() => {
    if (isEditing) {
      fetchCustomer();
    }
  }, [id]);

  const fetchCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setFormData({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        postal_code: data.postal_code || '',
        city: data.city || '',
        org_number: data.org_number || '',
        contact_person: data.contact_person || '',
        notes: data.notes || '',
        is_private: data.is_private || false
      });
    } catch (error) {
      console.error('Error fetching customer:', error);
      setError('Kunne ikke hente kunde');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const customerData = {
        ...formData,
        organization_id: organization.id
      };

      if (isEditing) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([customerData]);

        if (error) throw error;
      }

      navigate('/kunder');
    } catch (error) {
      console.error('Error saving customer:', error);
      setError('Kunne ikke lagre kunde. Prøv igjen.');
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
        <Link to="/kunder" className={`btn btn-ghost btn-sm ${styles.backButton}`}>
          <ArrowLeft size={16} />
          Tilbake til kunder
        </Link>
        <h2 className={styles.title}>
          {isEditing ? 'Rediger kunde' : 'Ny kunde'}
        </h2>
      </div>

      {error && (
        <div className={`badge badge-danger ${styles.errorAlert}`}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={`card ${styles.card}`}>
          <div className={styles.cardHeader}>
            <h3 className={`card-title ${styles.cardTitle}`}>
              Kundeinformasjon
            </h3>
            <label className={`${styles.privateToggle} ${formData.is_private ? styles.privateToggleActive : styles.privateToggleInactive}`}>
              <div className={`${styles.checkbox} ${formData.is_private ? styles.checkboxChecked : styles.checkboxUnchecked}`}>
                {formData.is_private && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                checked={formData.is_private}
                onChange={(e) => setFormData(prev => ({ ...prev, is_private: e.target.checked, org_number: '' }))}
                className={styles.hiddenInput}
              />
              Privatkunde
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="name">
                {formData.is_private ? 'Kundenavn *' : 'Firmanavn / Kundenavn *'}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className="form-input"
                placeholder={formData.is_private ? 'Ola Nordmann' : 'Eksempel AS'}
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            {!formData.is_private && (
              <div className="form-group">
                <label className="form-label" htmlFor="org_number">
                  Organisasjonsnummer
                </label>
                <input
                  id="org_number"
                  name="org_number"
                  type="text"
                  className="form-input"
                  placeholder="123 456 789"
                  value={formData.org_number}
                  onChange={handleChange}
                />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="contact_person">
                Kontaktperson
              </label>
              <input
                id="contact_person"
                name="contact_person"
                type="text"
                className="form-input"
                placeholder="Ola Nordmann"
                value={formData.contact_person}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                E-post
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                placeholder="post@eksempel.no"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">
              Telefon
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className={`form-input ${styles.phoneInput}`}
              placeholder="+47 123 45 678"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className={`card ${styles.card}`}>
          <h3 className={`card-title ${styles.cardTitleWithSpace}`}>
            Adresse
          </h3>

          <div className="form-group">
            <label className="form-label" htmlFor="address">
              Gateadresse
            </label>
            <input
              id="address"
              name="address"
              type="text"
              className="form-input"
              placeholder="Eksempelveien 123"
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="postal_code">
                Postnummer
              </label>
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
              <label className="form-label" htmlFor="city">
                Sted
              </label>
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

        <div className={`card ${styles.formFooter}`}>
          <h3 className={`card-title ${styles.cardTitleWithSpace}`}>
            Notater
          </h3>

          <div className={`form-group ${styles.notesGroup}`}>
            <textarea
              id="notes"
              name="notes"
              className="form-textarea"
              placeholder="Interne notater om kunden..."
              value={formData.notes}
              onChange={handleChange}
              rows={4}
            />
          </div>
        </div>

        <div className={styles.buttonRow}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            ) : (
              <>
                <Save size={18} />
                {isEditing ? 'Lagre endringer' : 'Opprett kunde'}
              </>
            )}
          </button>
          <Link to="/kunder" className="btn btn-secondary">
            Avbryt
          </Link>
        </div>
      </form>
    </div>
  );
}
