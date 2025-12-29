import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Layouts
import AppLayout from './layouts/AppLayout'
import AuthLayout from './layouts/AuthLayout'

// Auth Pages
import Login from './pages/Login'
import Register from './pages/Register'
import SetupOrganization from './pages/SetupOrganization'

// App Pages
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Customers from './pages/Customers'
import CustomerForm from './pages/CustomerForm'
import Jobs from './pages/Jobs'
import JobForm from './pages/JobForm'
import JobDetail from './pages/JobDetail'
import Quotes from './pages/Quotes'
import QuoteForm from './pages/QuoteForm'
import Invoices from './pages/Invoices'
import InvoiceDetail from './pages/InvoiceDetail'
import Articles from './pages/Articles'
import Employees from './pages/Employees'
import AcceptInvitation from './pages/AcceptInvitation'
import Settings from './pages/Settings'

// Protected Route Component - requires auth AND organization
function ProtectedRoute({ children }) {
  const { user, organization, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/logg-inn" replace />
  }
  
  // If user has no organization, redirect to setup
  if (!organization) {
    return <Navigate to="/setup" replace />
  }
  
  return children
}

// Setup Route - requires auth but NO organization
function SetupRoute({ children }) {
  const { user, organization, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/logg-inn" replace />
  }
  
  // If user already has organization, go to dashboard
  if (organization) {
    return <Navigate to="/dashboard" replace />
  }
  
  return children
}

// Public Route - redirect to dashboard if logged in
function PublicRoute({ children }) {
  const { user, organization, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    )
  }
  
  if (user) {
    // Redirect based on organization status
    if (organization) {
      return <Navigate to="/dashboard" replace />
    } else {
      return <Navigate to="/setup" replace />
    }
  }
  
  return children
}

// Temporary placeholder component
function ComingSoon({ title }) {
  return (
    <div className="card">
      <div className="empty-state">
        <h3 className="empty-state-title">{title}</h3>
        <p className="empty-state-description">
          Denne siden er under utvikling og kommer snart.
        </p>
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<PublicRoute><AuthLayout /></PublicRoute>}>
        <Route path="/logg-inn" element={<Login />} />
        <Route path="/registrer" element={<Register />} />
      </Route>

      {/* Setup Organization Route - for new users without org */}
      <Route 
        path="/setup" 
        element={
          <SetupRoute>
            <SetupOrganization />
          </SetupRoute>
        } 
      />

      {/* Public invitation route - accessible without login */}
      <Route path="/invitasjon/:token" element={<AcceptInvitation />} />

      {/* Protected App Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/kalender" element={<Calendar />} />
        <Route path="/kunder" element={<Customers />} />
        <Route path="/kunder/ny" element={<CustomerForm />} />
        <Route path="/kunder/:id" element={<CustomerForm />} />
        <Route path="/kunder/:id/rediger" element={<CustomerForm />} />
        <Route path="/jobber" element={<Jobs />} />
        <Route path="/jobber/ny" element={<JobForm />} />
        <Route path="/jobber/:id" element={<JobDetail />} />
        <Route path="/jobber/:id/rediger" element={<JobForm />} />
        <Route path="/tilbud" element={<Quotes />} />
        <Route path="/tilbud/ny" element={<QuoteForm />} />
        <Route path="/tilbud/:id" element={<QuoteForm />} />
        <Route path="/tilbud/:id/rediger" element={<QuoteForm />} />
        <Route path="/fakturaer" element={<Invoices />} />
        <Route path="/fakturaer/ny" element={<InvoiceDetail />} />
        <Route path="/fakturaer/:id" element={<InvoiceDetail />} />
        <Route path="/artikler" element={<Articles />} />
        <Route path="/timer" element={<ComingSoon title="Timeregistrering" />} />
        <Route path="/kjoretoy" element={<ComingSoon title="Kjøretøy" />} />
        <Route path="/dokumenter" element={<ComingSoon title="Dokumenter" />} />
        <Route path="/ansatte" element={<Employees />} />
        <Route path="/innstillinger" element={<Settings />} />
      </Route>

      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      {/* 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
