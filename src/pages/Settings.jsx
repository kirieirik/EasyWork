import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Building2,
  CreditCard,
  FileText,
  Link2,
  Users,
  Save,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Settings as SettingsIcon,
  Shield
} from 'lucide-react';
import styles from './Settings.module.css';

const TABS = [
  { id: 'company', label: 'Bedriftsinformasjon', icon: Building2 },
  { id: 'bank', label: 'Bankinformasjon', icon: CreditCard },
  { id: 'invoice', label: 'Fakturainnstillinger', icon: FileText },
  { id: 'integrations', label: 'Integrasjoner', icon: Link2 },
];

const INTEGRATION_PROVIDERS = [
  { id: 'none', name: 'Ingen integrasjon', description: 'Bruk EasyWork standalone' },
  { id: 'tripletex', name: 'Tripletex', description: 'Norges mest populære regnskapsprogram' },
  { id: 'duett', name: 'Duett', description: 'Komplett økonomisystem' },
  { id: 'visma', name: 'Visma eAccounting', description: 'Regnskap i skyen' },
  { id: 'fiken', name: 'Fiken', description: 'Enkelt regnskap for små bedrifter' },
  { id: 'poweroffice', name: 'PowerOffice Go', description: 'Moderne regnskapsløsning' },
];

export default function Settings() {
  const { profile, organization, setOrganization } = useAuth();
  const [activeTab, setActiveTab] = useState('company');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [formData, setFormData] = useState({
    // Company info
    name: '',
    org_number: '',
    email: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
    country: 'Norge',
    website: '',
    // Bank info
    bank_account: '',
    bank_name: '',
    iban: '',
    swift_bic: '',
    // Invoice settings
    invoice_prefix: '',
    invoice_start_number: 1,
    default_payment_days: 14,
    default_vat_rate: 25,
    default_invoice_terms: 'Betaling innen forfallsdato. Ved forsinket betaling påløper forsinkelsesrenter.',
    default_invoice_notes: '',
    // Integration
    integration_provider: 'none',
    integration_api_key: '',
    integration_enabled: false,
  });

  // Check if user is admin or owner
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        org_number: organization.org_number || '',
        email: organization.email || '',
        phone: organization.phone || '',
        address: organization.address || '',
        postal_code: organization.postal_code || '',
        city: organization.city || '',
        country: organization.country || 'Norge',
        website: organization.website || '',
        bank_account: organization.bank_account || '',
        bank_name: organization.bank_name || '',
        iban: organization.iban || '',
        swift_bic: organization.swift_bic || '',
        invoice_prefix: organization.invoice_prefix || '',
        invoice_start_number: organization.invoice_start_number || 1,
        default_payment_days: organization.default_payment_days || 14,
        default_vat_rate: organization.default_vat_rate || 25,
        default_invoice_terms: organization.default_invoice_terms || 'Betaling innen forfallsdato. Ved forsinket betaling påløper forsinkelsesrenter.',
        default_invoice_notes: organization.default_invoice_notes || '',
        integration_provider: organization.integration_provider || 'none',
        integration_api_key: organization.integration_api_key || '',
        integration_enabled: organization.integration_enabled || false,
      });
    }
  }, [organization]);

  const handleSave = async () => {
    if (!isAdmin) {
      setSaveMessage({ type: 'error', text: 'Du har ikke tilgang til å endre innstillinger' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const { data, error } = await supabase
        .from('organizations')
        .update({
          name: formData.name,
          org_number: formData.org_number || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          postal_code: formData.postal_code || null,
          city: formData.city || null,
          country: formData.country || 'Norge',
          website: formData.website || null,
          bank_account: formData.bank_account || null,
          bank_name: formData.bank_name || null,
          iban: formData.iban || null,
          swift_bic: formData.swift_bic || null,
          invoice_prefix: formData.invoice_prefix || null,
          invoice_start_number: formData.invoice_start_number || 1,
          default_payment_days: formData.default_payment_days || 14,
          default_vat_rate: formData.default_vat_rate || 25,
          default_invoice_terms: formData.default_invoice_terms || null,
          default_invoice_notes: formData.default_invoice_notes || null,
          integration_provider: formData.integration_provider || 'none',
          integration_api_key: formData.integration_api_key || null,
          integration_enabled: formData.integration_enabled || false,
          updated_at: new Date().toISOString()
        })
        .eq('id', organization.id)
        .select()
        .single();

      if (error) throw error;

      // Update context
      setOrganization(data);
      setSaveMessage({ type: 'success', text: 'Innstillinger lagret!' });
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage({ type: 'error', text: 'Kunne ikke lagre innstillinger. Prøv igjen.' });
    } finally {
      setSaving(false);
    }
  };

  const formatBankAccount = (value) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');
    // Format as XXXX.XX.XXXXX
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 11)}`;
  };

  const handleBankAccountChange = (e) => {
    const formatted = formatBankAccount(e.target.value);
    setFormData({ ...formData, bank_account: formatted });
  };

  if (!isAdmin) {
    return (
      <div className={styles.noAccess}>
        <Shield size={64} />
        <h2>Ingen tilgang</h2>
        <p>Du må være administrator eller eier for å se innstillinger.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Innstillinger</h1>
          <p className={styles.subtitle}>Administrer bedriftens innstillinger</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={18} />
          {saving ? 'Lagrer...' : 'Lagre endringer'}
        </button>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`${styles.message} ${styles[saveMessage.type]}`}>
          {saveMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {saveMessage.text}
        </div>
      )}

      <div className={styles.content}>
        {/* Sidebar Navigation */}
        <nav className={styles.sidebar}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`${styles.navItem} ${activeTab === tab.id ? styles.active : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
                <ChevronRight size={16} className={styles.chevron} />
              </button>
            );
          })}
        </nav>

        {/* Main Content */}
        <div className={styles.main}>
          {/* Company Info Tab */}
          {activeTab === 'company' && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <Building2 size={22} />
                Bedriftsinformasjon
              </h2>
              <p className={styles.sectionDesc}>
                Denne informasjonen vises på fakturaer og tilbud.
              </p>

              <div className={styles.formGrid}>
                <div className="form-group">
                  <label className="form-label">Firmanavn *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ditt firma AS"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Organisasjonsnummer</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.org_number}
                    onChange={(e) => setFormData({ ...formData, org_number: e.target.value })}
                    placeholder="123 456 789"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">E-post</label>
                  <input
                    type="email"
                    className="form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="post@firma.no"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+47 123 45 678"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Adresse</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Gateadresse 123"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Postnummer</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="0123"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sted</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Oslo"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Land</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="Norge"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Nettside</label>
                  <input
                    type="url"
                    className="form-input"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://www.firma.no"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bank Info Tab */}
          {activeTab === 'bank' && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <CreditCard size={22} />
                Bankinformasjon
              </h2>
              <p className={styles.sectionDesc}>
                Kontonummer og bankdetaljer som vises på fakturaer.
              </p>

              <div className={styles.formGrid}>
                <div className="form-group">
                  <label className="form-label">Kontonummer</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.bank_account}
                    onChange={handleBankAccountChange}
                    placeholder="1234.56.12345"
                    maxLength={13}
                  />
                  <span className="form-hint">Norsk format: XXXX.XX.XXXXX</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Banknavn</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="DNB, Nordea, SpareBank 1..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">IBAN (valgfritt)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                    placeholder="NO12 3456 7890 1234 56"
                  />
                  <span className="form-hint">For internasjonale betalinger</span>
                </div>

                <div className="form-group">
                  <label className="form-label">SWIFT/BIC (valgfritt)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.swift_bic}
                    onChange={(e) => setFormData({ ...formData, swift_bic: e.target.value.toUpperCase() })}
                    placeholder="DNBANOKK"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Invoice Settings Tab */}
          {activeTab === 'invoice' && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FileText size={22} />
                Fakturainnstillinger
              </h2>
              <p className={styles.sectionDesc}>
                Standardverdier og innstillinger for fakturaer.
              </p>

              <div className={styles.formGrid}>
                <div className="form-group">
                  <label className="form-label">Fakturanummer-prefix</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.invoice_prefix}
                    onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
                    placeholder="F-"
                  />
                  <span className="form-hint">F.eks. "F-" gir fakturanummer F-1, F-2...</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Startnummer</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.invoice_start_number}
                    onChange={(e) => setFormData({ ...formData, invoice_start_number: parseInt(e.target.value) || 1 })}
                    min={1}
                  />
                  <span className="form-hint">Første fakturanummer</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Standard betalingsfrist</label>
                  <select
                    className="form-select"
                    value={formData.default_payment_days}
                    onChange={(e) => setFormData({ ...formData, default_payment_days: parseInt(e.target.value) })}
                  >
                    <option value={7}>7 dager</option>
                    <option value={10}>10 dager</option>
                    <option value={14}>14 dager</option>
                    <option value={21}>21 dager</option>
                    <option value={30}>30 dager</option>
                    <option value={45}>45 dager</option>
                    <option value={60}>60 dager</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Standard MVA-sats</label>
                  <select
                    className="form-select"
                    value={formData.default_vat_rate}
                    onChange={(e) => setFormData({ ...formData, default_vat_rate: parseFloat(e.target.value) })}
                  >
                    <option value={0}>0% (Fritatt)</option>
                    <option value={12}>12% (Mat)</option>
                    <option value={15}>15% (Transport)</option>
                    <option value={25}>25% (Standard)</option>
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Standard betalingsvilkår</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={formData.default_invoice_terms}
                    onChange={(e) => setFormData({ ...formData, default_invoice_terms: e.target.value })}
                    placeholder="Betaling innen forfallsdato..."
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Standard fakturanotat</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={formData.default_invoice_notes}
                    onChange={(e) => setFormData({ ...formData, default_invoice_notes: e.target.value })}
                    placeholder="Vises nederst på alle fakturaer..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <Link2 size={22} />
                Integrasjoner
              </h2>
              <p className={styles.sectionDesc}>
                Koble til eksternt regnskapssystem for automatisk synkronisering.
              </p>

              <div className={styles.integrationList}>
                {INTEGRATION_PROVIDERS.map(provider => (
                  <div 
                    key={provider.id}
                    className={`${styles.integrationCard} ${formData.integration_provider === provider.id ? styles.selected : ''}`}
                    onClick={() => setFormData({ ...formData, integration_provider: provider.id })}
                  >
                    <div className={styles.integrationRadio}>
                      <input
                        type="radio"
                        name="integration"
                        checked={formData.integration_provider === provider.id}
                        onChange={() => setFormData({ ...formData, integration_provider: provider.id })}
                      />
                    </div>
                    <div className={styles.integrationInfo}>
                      <h4>{provider.name}</h4>
                      <p>{provider.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {formData.integration_provider !== 'none' && (
                <div className={styles.integrationSettings}>
                  <h3>Integrasjonsinnstillinger for {INTEGRATION_PROVIDERS.find(p => p.id === formData.integration_provider)?.name}</h3>
                  
                  <div className={styles.formGrid}>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">API-nøkkel</label>
                      <input
                        type="password"
                        className="form-input"
                        value={formData.integration_api_key}
                        onChange={(e) => setFormData({ ...formData, integration_api_key: e.target.value })}
                        placeholder="Lim inn API-nøkkel her..."
                      />
                      <span className="form-hint">
                        Finn API-nøkkelen i innstillingene til {INTEGRATION_PROVIDERS.find(p => p.id === formData.integration_provider)?.name}
                      </span>
                    </div>

                    <div className="form-group">
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={formData.integration_enabled}
                          onChange={(e) => setFormData({ ...formData, integration_enabled: e.target.checked })}
                        />
                        <span>Aktiver integrasjon</span>
                      </label>
                      <span className="form-hint">
                        Når aktivert vil fakturaer automatisk sendes til regnskapssystemet
                      </span>
                    </div>
                  </div>

                  <div className={styles.integrationNote}>
                    <AlertCircle size={18} />
                    <p>
                      <strong>Merk:</strong> Integrasjonen synkroniserer kun én vei fra EasyWork til regnskapssystemet. 
                      Fakturaer som opprettes i EasyWork vil automatisk opprettes i {INTEGRATION_PROVIDERS.find(p => p.id === formData.integration_provider)?.name}.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Save Button */}
      <div className={styles.mobileSave}>
        <button 
          className="btn btn-primary w-full"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={18} />
          {saving ? 'Lagrer...' : 'Lagre endringer'}
        </button>
      </div>
    </div>
  );
}
