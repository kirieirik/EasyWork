import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Briefcase,
  FileText,
  Receipt,
  Clock,
  Truck,
  FolderOpen,
  UserCog,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Wrench,
  Package
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Kalender', href: '/kalender', icon: Calendar },
  { name: 'Kunder', href: '/kunder', icon: Users },
  { name: 'Jobber', href: '/jobber', icon: Briefcase },
  { name: 'Tilbud', href: '/tilbud', icon: FileText },
  { name: 'Fakturaer', href: '/fakturaer', icon: Receipt },
  { name: 'Artikler', href: '/artikler', icon: Package },
  { name: 'Timer', href: '/timer', icon: Clock },
  { name: 'Kjøretøy', href: '/kjoretoy', icon: Truck },
  { name: 'Dokumenter', href: '/dokumenter', icon: FolderOpen },
];

const adminNavigation = [
  { name: 'Ansatte', href: '/ansatte', icon: UserCog },
  { name: 'Innstillinger', href: '/innstillinger', icon: Settings },
];

const mobileNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Kunder', href: '/kunder', icon: Users },
  { name: 'Jobber', href: '/jobber', icon: Briefcase },
  { name: 'Timer', href: '/timer', icon: Clock },
];

export default function AppLayout() {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/kalender') return 'Kalender';
    if (path.startsWith('/kunder')) return 'Kunder';
    if (path.startsWith('/jobber')) return 'Jobber';
    if (path.startsWith('/tilbud')) return 'Tilbud';
    if (path.startsWith('/fakturaer')) return 'Fakturaer';
    if (path.startsWith('/artikler')) return 'Artikler';
    if (path.startsWith('/timer')) return 'Timer';
    if (path.startsWith('/kjoretoy')) return 'Kjøretøy';
    if (path.startsWith('/dokumenter')) return 'Dokumenter';
    if (path.startsWith('/ansatte')) return 'Ansatte';
    if (path.startsWith('/innstillinger')) return 'Innstillinger';
    return 'EasyWork';
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  return (
    <div className="app-layout">
      {/* Sidebar Overlay (mobile) */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Wrench size={28} />
            <span>EasyWork</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Hovedmeny</div>
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon size={20} />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </div>

          {isAdmin && (
            <div className="nav-section">
              <div className="nav-section-title">Administrasjon</div>
              {adminNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/innstillinger"
            className="user-menu"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="user-avatar">
              {getInitials()}
            </div>
            <div className="user-info">
              <div className="user-name">
                {profile?.full_name || user?.email}
              </div>
              <div className="user-role">
                {profile?.role === 'owner' ? 'Eier' : 
                 profile?.role === 'admin' ? 'Administrator' : 'Ansatt'}
              </div>
            </div>
          </NavLink>
          
          <button 
            className="nav-item logout-btn" 
            onClick={signOut}
          >
            <LogOut size={20} />
            <span>Logg ut</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="app-header">
          <div className="header-left">
            <button 
              className="menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 className="page-title">{getPageTitle()}</h1>
          </div>
          
          <div className="header-right">
            <button className="header-icon-btn">
              <Bell size={20} />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          <Outlet />
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="mobile-nav">
        <div className="mobile-nav-items">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          ))}
          <button
            className="mobile-nav-item"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
            <span>Mer</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
