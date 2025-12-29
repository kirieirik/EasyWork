import { Outlet } from 'react-router-dom';
import { Wrench } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-logo">
          <Wrench size={32} />
          <span>EasyWork</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
