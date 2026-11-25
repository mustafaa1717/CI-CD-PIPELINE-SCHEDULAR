import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useEffect, useRef } from 'react';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAuthenticated, loading } = useAuth();
  const toastFiredRef = useRef(false);

  useEffect(() => {
    if (!loading && !isAuthenticated && !toastFiredRef.current) {
      toast.error('Authentication required to access this resource');
      toastFiredRef.current = true;
    } else if (!loading && isAuthenticated && adminOnly && !user?.is_admin && !toastFiredRef.current) {
      toast.error('Administrator privileges required');
      toastFiredRef.current = true;
    }
  }, [loading, isAuthenticated, adminOnly, user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#94a3b8' }}>
        <div style={{ width: '28px', height: '28px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !user?.is_admin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
