import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Building2, Mail, Phone, MapPin, Hash, ArrowRight, Loader2 } from 'lucide-react';
import styles from './SetupOrganization.module.css';

export default function SetupOrganization() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: user?.email || '',
    phone: '',
    org_number: '',
    address: '',
    postal_code: '',
    city: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Bedriftsnavn er påkrevd');
      return;
    }

    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.rpc('create_organization_with_owner', {
        org_name: formData.name,
        org_email: formData.email || null,
        org_phone: formData.phone || null,
        org_number: formData.org_number || null,
        org_address: formData.address || null,
        org_postal_code: formData.postal_code || null,
        org_city: formData.city || null
      });

      if (fnError) throw fnError;

      if (data?.success) {
        // Refresh the page to reload auth context
        window.location.href = '/';
      } else {
        throw new Error(data?.error || 'Kunne ikke opprette bedrift');
      }
    } catch (err) {
      console.error('Error creating organization:', err);
      setError(err.message || 'Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <Building2 size={32} />
          </div>
          <h1>Sett opp din bedrift</h1>
          <p>Opprett din bedrift for å komme i gang med EasyWork</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <Building2 size={16} />
              Bedriftsnavn *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="F.eks. Hansen Bygg AS"
              className={styles.input}
              required
              autoFocus
            />
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <Hash size={16} />
                Org.nummer
              </label>
              <input
                type="text"
                name="org_number"
                value={formData.org_number}
                onChange={handleChange}
                placeholder="123 456 789"
                className={styles.input}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <Phone size={16} />
                Telefon
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+47 123 45 678"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <Mail size={16} />
              E-post
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="post@firma.no"
              className={styles.input}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <MapPin size={16} />
              Adresse
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Gateadresse 123"
              className={styles.input}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Postnummer</label>
              <input
                type="text"
                name="postal_code"
                value={formData.postal_code}
                onChange={handleChange}
                placeholder="0123"
                className={styles.input}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Sted</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Oslo"
                className={styles.input}
              />
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className={styles.spinner} />
                Oppretter bedrift...
              </>
            ) : (
              <>
                Opprett bedrift
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className={styles.footer}>
          Du blir automatisk administrator for bedriften og kan invitere andre brukere.
        </p>
      </div>
    </div>
  );
}
