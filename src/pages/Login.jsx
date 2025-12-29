import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        if (signInError.message.includes('Invalid login')) {
          setError('Feil e-post eller passord');
        } else {
          setError(signInError.message);
        }
        setLoading(false);
      }
      // Don't navigate here - let AuthContext and PublicRoute handle redirect
      // after profile/organization is loaded
    } catch (err) {
      setError('Noe gikk galt. Prøv igjen.');
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="auth-title">Velkommen tilbake</h2>
      <p className="auth-subtitle">Logg inn for å fortsette til EasyWork</p>

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
          <label className="form-label" htmlFor="email">E-post</label>
          <div className="search-input-wrapper">
            <Mail size={18} />
            <input
              id="email"
              type="email"
              className="form-input search-input"
              placeholder="din@epost.no"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              type="password"
              className="form-input search-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
              <LogIn size={18} />
              Logg inn
            </>
          )}
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Har du ikke konto?{' '}
          <Link to="/registrer" className="auth-link">Registrer deg</Link>
        </p>
      </div>
    </>
  );
}
