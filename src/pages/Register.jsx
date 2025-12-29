import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Mail, Lock, User, Building2, AlertCircle, CheckCircle } from 'lucide-react';

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passordene matcher ikke');
      return;
    }
    
    if (formData.password.length < 6) {
      setError('Passordet må være minst 6 tegn');
      return;
    }

    setLoading(true);

    try {
      const { error: signUpError } = await signUp(
        formData.email, 
        formData.password,
        {
          full_name: formData.fullName,
          organization_name: formData.organizationName,
        }
      );

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('Denne e-postadressen er allerede registrert');
        } else {
          setError(signUpError.message);
        }
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <CheckCircle size={48} color="var(--color-accent)" />
        </div>
        <h2 className="auth-title">Sjekk e-posten din</h2>
        <p className="auth-subtitle">
          Vi har sendt deg en bekreftelseslenke. Klikk på lenken for å aktivere kontoen din.
        </p>
        <Link to="/logg-inn" className="btn btn-primary w-full">
          Tilbake til innlogging
        </Link>
      </>
    );
  }

  return (
    <>
      <h2 className="auth-title">Opprett konto</h2>
      <p className="auth-subtitle">Kom i gang med EasyWork i dag</p>

      {error && (
        <div className="badge badge-danger" style={{ 
          width: '100%', 
          padding: '0.75rem', 
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="fullName">Fullt navn</label>
          <div className="search-input-wrapper">
            <User size={18} />
            <input
              id="fullName"
              name="fullName"
              type="text"
              className="form-input search-input"
              placeholder="Ola Nordmann"
              value={formData.fullName}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="organizationName">Firmanavn</label>
          <div className="search-input-wrapper">
            <Building2 size={18} />
            <input
              id="organizationName"
              name="organizationName"
              type="text"
              className="form-input search-input"
              placeholder="Mitt Firma AS"
              value={formData.organizationName}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">E-post</label>
          <div className="search-input-wrapper">
            <Mail size={18} />
            <input
              id="email"
              name="email"
              type="email"
              className="form-input search-input"
              placeholder="din@epost.no"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Passord</label>
          <div className="search-input-wrapper">
            <Lock size={18} />
            <input
              id="password"
              name="password"
              type="password"
              className="form-input search-input"
              placeholder="Minst 6 tegn"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirmPassword">Bekreft passord</label>
          <div className="search-input-wrapper">
            <Lock size={18} />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="form-input search-input"
              placeholder="Gjenta passordet"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary w-full"
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
          ) : (
            <>
              <UserPlus size={18} />
              Opprett konto
            </>
          )}
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Har du allerede konto?{' '}
          <Link to="/logg-inn" className="auth-link">Logg inn</Link>
        </p>
      </div>
    </>
  );
}
