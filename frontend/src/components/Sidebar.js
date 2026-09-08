import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, 
  Settings, 
  User as UserIcon,
  BarChart3,
  Menu,
  X,
  Briefcase,
  Phone,
  Calculator,
  FileText,
  ShoppingCart,
  Receipt,
  Clock,
  FileBarChart
} from 'lucide-react';

const Sidebar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      title: 'Dashboard',
      icon: BarChart3,
      path: '/dashboard',
      onClick: () => {
        navigate('/dashboard');
        setIsOpen(false);
      }
    },
    ...(user?.role === 'admin' ? [{
      title: 'User Management',
      icon: Users,
      path: '/users',
      onClick: () => {
        navigate('/users');
        setIsOpen(false);
      }
    }] : []),
    {
      title: 'Services',
      icon: Briefcase,
      path: '/services',
      onClick: () => {
        navigate('/services');
        setIsOpen(false);
      }
    },
    {
      title: 'Contacts',
      icon: Phone,
      path: '/contacts',
      onClick: () => {
        navigate('/contacts');
        setIsOpen(false);
      }
    },
    {
      title: 'Tax',
      icon: Calculator,
      path: '/tax',
      onClick: () => {
        navigate('/tax');
        setIsOpen(false);
      }
    },
    {
      title: 'Quotations',
      icon: FileText,
      path: '/quotations',
      onClick: () => {
        navigate('/quotations');
        setIsOpen(false);
      }
    },
    {
      title: 'Sale Orders',
      icon: ShoppingCart,
      path: '/sale-orders',
      onClick: () => {
        navigate('/sale-orders');
        setIsOpen(false);
      }
    },
    {
      title: 'Proforma Invoices',
      icon: Receipt,
      path: '/proforma-invoices',
      onClick: () => {
        navigate('/proforma-invoices');
        setIsOpen(false);
      }
    },
    {
      title: 'Recurring Invoice',
      icon: Clock,
      path: '/recurring-invoice',
      onClick: () => {
        navigate('/recurring-invoice');
        setIsOpen(false);
      }
    },
    {
      title: 'Reports',
      icon: FileBarChart,
      path: '/reports',
      onClick: () => {
        navigate('/reports');
        setIsOpen(false);
      }
    },
    {
      title: 'Profile',
      icon: UserIcon,
      path: '/profile',
      onClick: () => {
        navigate('/profile');
        setIsOpen(false);
      }
    },
    ...(user?.role === 'admin' ? [{
      title: 'Settings',
      icon: Settings,
      path: '/settings',
      onClick: () => {
        navigate('/settings');
        setIsOpen(false);
      }
    }] : [])
  ];

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleSidebar}
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 1001,
          display: 'none',
          padding: '0.5rem',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}
        className="mobile-menu-btn"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            display: 'none'
          }}
          className="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <div
        className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
        style={{
          width: '256px',
          backgroundColor: 'white',
          borderRight: '1px solid #e5e7eb',
          padding: '1.5rem 0',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1000,
          transition: 'transform 0.3s ease-in-out'
        }}
      >
        {/* Logo and Title Section */}
        <div style={{ 
          padding: '0 1.5rem', 
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          {/* Logo */}
          <div style={{
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <img 
              src="/logo.svg" 
              alt="Webindia CRM Logo" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
          
          {/* Title */}
          <div>
            <h1 style={{
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: 0,
              lineHeight: 1.2
            }}>
              Webindia CRM
            </h1>
            <p style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              margin: 0,
              lineHeight: 1
            }}>
              Business Solutions
            </p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav style={{ flex: 1 }}>
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={index}
                onClick={item.onClick}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  backgroundColor: isActive ? '#eff6ff' : 'transparent',
                  color: isActive ? '#1d4ed8' : '#6b7280',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  textAlign: 'left'
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.target.style.backgroundColor = '#f9fafb';
                    e.target.style.color = '#374151';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#6b7280';
                  }
                }}
              >
                <Icon size={20} style={{ marginRight: '0.75rem' }} />
                {item.title}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
