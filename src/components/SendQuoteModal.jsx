import { useState, useEffect } from 'react';
import styles from './SendQuoteModal.module.css';

export default function SendQuoteModal({ 
  isOpen, 
  onClose, 
  quote, 
  customer, 
  organization, 
  userEmail,
  onSend 
}) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [useCustomerEmail, setUseCustomerEmail] = useState(true);
  const [customEmail, setCustomEmail] = useState('');
  const [sendCopy, setSendCopy] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Default message template
  const defaultMessage = `Hei,

Vedlagt finner du tilbud #${quote?.quote_number} fra ${organization?.name || 'oss'}.

${quote?.title ? `Tilbud: ${quote.title}` : ''}
${quote?.valid_until ? `Gyldig til: ${new Date(quote.valid_until).toLocaleDateString('nb-NO')}` : ''}

Ta gjerne kontakt om du har spørsmål.

Med vennlig hilsen,
${organization?.name || ''}
${organization?.phone ? `Tlf: ${organization.phone}` : ''}
${organization?.email ? `E-post: ${organization.email}` : ''}`;

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setUseCustomerEmail(!!customer?.email);
      setCustomEmail('');
      setSendCopy(true);
      setMessage(defaultMessage);
      setError(null);
      setSuccess(false);
      
      // Set recipient email
      if (customer?.email) {
        setRecipientEmail(customer.email);
      } else {
        setRecipientEmail('');
        setUseCustomerEmail(false);
      }
    }
  }, [isOpen, customer, quote, organization]);

  const handleEmailSourceChange = (useCustomer) => {
    setUseCustomerEmail(useCustomer);
    if (useCustomer && customer?.email) {
      setRecipientEmail(customer.email);
    } else {
      setRecipientEmail(customEmail);
    }
  };

  const handleCustomEmailChange = (e) => {
    setCustomEmail(e.target.value);
    if (!useCustomerEmail) {
      setRecipientEmail(e.target.value);
    }
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSend = async () => {
    setError(null);
    
    // Validate email
    if (!recipientEmail || !validateEmail(recipientEmail)) {
      setError('Vennligst oppgi en gyldig e-postadresse');
      return;
    }

    setSending(true);

    try {
      await onSend({
        to: recipientEmail,
        bcc: sendCopy ? userEmail : null,
        subject: `Tilbud fra ${organization?.name || 'oss'}`,
        message: message,
      });
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to send email:', err);
      setError(err.message || 'Kunne ikke sende e-post. Prøv igjen senere.');
    } finally {
      setSending(false);
    }
  };

  // Fallback: Open mailto link
  const handleMailtoFallback = () => {
    const subject = encodeURIComponent(`Tilbud fra ${organization?.name || 'oss'}`);
    const body = encodeURIComponent(message + '\n\n(Vedlegg: Last ned PDF-en og legg ved manuelt)');
    const bcc = sendCopy && userEmail ? `&bcc=${encodeURIComponent(userEmail)}` : '';
    
    window.open(`mailto:${recipientEmail}?subject=${subject}&body=${body}${bcc}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Send tilbud</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className={styles.successMessage}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h3>Tilbud sendt!</h3>
            <p>E-post er sendt til {recipientEmail}</p>
          </div>
        ) : (
          <>
            <div className={styles.content}>
              {/* Quote info */}
              <div className={styles.quoteInfo}>
                <span className={styles.quoteNumber}>Tilbud #{quote?.quote_number}</span>
                <span className={styles.quoteTitle}>{quote?.title || 'Uten tittel'}</span>
              </div>

              {/* Email recipient */}
              <div className={styles.field}>
                <label>Mottaker</label>
                
                {customer?.email && (
                  <div className={styles.emailOptions}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        checked={useCustomerEmail}
                        onChange={() => handleEmailSourceChange(true)}
                      />
                      <span>Kundens e-post</span>
                      <span className={styles.emailPreview}>{customer.email}</span>
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        checked={!useCustomerEmail}
                        onChange={() => handleEmailSourceChange(false)}
                      />
                      <span>Annen e-post</span>
                    </label>
                  </div>
                )}

                {(!customer?.email || !useCustomerEmail) && (
                  <input
                    type="email"
                    className={styles.input}
                    placeholder="navn@eksempel.no"
                    value={customEmail}
                    onChange={handleCustomEmailChange}
                    autoFocus={!customer?.email}
                  />
                )}
              </div>

              {/* Subject preview */}
              <div className={styles.field}>
                <label>Emne</label>
                <div className={styles.subjectPreview}>
                  Tilbud fra {organization?.name || 'oss'}
                </div>
              </div>

              {/* Message */}
              <div className={styles.field}>
                <label>Melding</label>
                <textarea
                  className={styles.textarea}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                />
              </div>

              {/* BCC option */}
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={sendCopy}
                  onChange={(e) => setSendCopy(e.target.checked)}
                />
                <span>Send kopi til meg ({userEmail})</span>
              </label>

              {error && (
                <div className={styles.error}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}
            </div>

            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={onClose}>
                Avbryt
              </button>
              <div className={styles.sendButtons}>
                <button 
                  className={styles.mailtoBtn} 
                  onClick={handleMailtoFallback}
                  title="Åpne i e-postklient"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Åpne i e-post
                </button>
                <button 
                  className={styles.sendBtn} 
                  onClick={handleSend}
                  disabled={sending || !recipientEmail}
                >
                  {sending ? (
                    <>
                      <span className={styles.spinner}></span>
                      Sender...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      Send tilbud
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
