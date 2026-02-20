import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserDropdown from './UserDropdown';
import Sidebar from './Sidebar';
import { 
  Users, 
  Shield,
  Calendar,
  BarChart3,
  User as UserIcon
} from 'lucide-react';
import api from '../utils/axiosConfig';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const resp = await api.get('/dashboard-stats.php', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (resp.data && resp.data.success) {
          setStats(resp.data.data);
        } else {
          setError(resp.data?.message || 'Failed to load stats');
        }
      } catch (e) {
        setError('Failed to load stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="main-container" style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc'
    }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="main-content" style={{ flex: 1, padding: '2rem' }}>
        {/* Header with User Dropdown */}
        <div className="header-section" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '2rem' 
        }}>
          <div>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#1f2937',
              marginBottom: '0.5rem'
            }}>
              Welcome back, {user?.first_name || user?.username}!
            </h2>
            <p style={{ color: '#6b7280' }}>
              Here's what's happening with your CRM today.
            </p>
          </div>
          <div className="user-dropdown">
            <UserDropdown />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {user?.role === 'admin' && (
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#dbeafe',
                borderRadius: '0.5rem',
                marginRight: '1rem'
              }}>
                <Users style={{ color: '#3b82f6' }} size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Users</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>{loading ? '-' : (stats?.users_count ?? '-')}</p>
              </div>
            </div>
          </div>
          )}

          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#dcfce7',
                borderRadius: '0.5rem',
                marginRight: '1rem'
              }}>
                <Calendar style={{ color: '#16a34a' }} size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Services</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>{loading ? '-' : (stats?.services_count ?? '-')}</p>
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#fef3c7',
                borderRadius: '0.5rem',
                marginRight: '1rem'
              }}>
                <BarChart3 style={{ color: '#d97706' }} size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Quotations</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>{loading ? '-' : (stats?.quotations_count ?? '-')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* More Stats */}
        <div className="stats-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#e0e7ff', borderRadius: '0.5rem', marginRight: '1rem' }}>
                <BarChart3 style={{ color: '#4f46e5' }} size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Sale Orders</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>{loading ? '-' : (stats?.sale_orders_count ?? '-')}</p>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#ffedd5', borderRadius: '0.5rem', marginRight: '1rem' }}>
                <Calendar style={{ color: '#ea580c' }} size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Proforma Invoices</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>{loading ? '-' : (stats?.proforma_invoices_count ?? '-')}</p>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#dcfce7', borderRadius: '0.5rem', marginRight: '1rem' }}>
                <BarChart3 style={{ color: '#16a34a' }} size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Amount (PI)</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>{loading ? '-' : (new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(stats?.proforma_total_amount || 0))}</p>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#e0f2fe', borderRadius: '0.5rem', marginRight: '1rem' }}>
                <BarChart3 style={{ color: '#0284c7' }} size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Invoiced Amount (PI)</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>{loading ? '-' : (new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(stats?.proforma_invoiced_amount || 0))}</p>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', borderRadius: '0.5rem', marginRight: '1rem' }}>
                <BarChart3 style={{ color: '#dc2626' }} size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Outstanding Amount (PI)</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>{loading ? '-' : (new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(stats?.proforma_outstanding_amount || 0))}</p>
              </div>
            </div>
          </div>
        </div>

        {/* User Info Card */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{
              padding: '0.75rem',
              backgroundColor: user?.role === 'admin' ? '#fef2f2' : '#f0f9ff',
              borderRadius: '0.5rem',
              marginRight: '1rem'
            }}>
              {user?.role === 'admin' ? (
                <Shield style={{ color: '#dc2626' }} size={24} />
              ) : (
                <UserIcon style={{ color: '#0ea5e9' }} size={24} />
              )}
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
                Your Account
              </h3>
              <p style={{ color: '#6b7280' }}>
                Role: <span style={{ 
                  color: user?.role === 'admin' ? '#dc2626' : '#0ea5e9',
                  fontWeight: '500'
                }}>
                  {user?.role?.toUpperCase()}
                </span>
              </p>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Username</p>
              <p style={{ fontWeight: '500', color: '#1f2937' }}>{user?.username}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Email</p>
              <p style={{ fontWeight: '500', color: '#1f2937' }}>{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
