import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Settings, ChevronDown } from 'lucide-react';
import api, { toAbsoluteUrl } from '../utils/axiosConfig';

const UserDropdown = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    };

  const menuItems = [
    {
      title: 'Profile',
      icon: User,
      onClick: () => {
        navigate('/profile');
        setIsOpen(false);
      }
    },
    {
      title: 'Settings',
      icon: Settings,
      onClick: () => {
        setIsOpen(false);
      }
    }
  ];

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.5rem',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          transition: 'background-color 0.15s ease-in-out'
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = '#f3f4f6';
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = 'transparent';
        }}
      >
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: user?.profile_image ? 'transparent' : '#3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '0.5rem',
          overflow: 'hidden',
          border: user?.profile_image ? '2px solid #e5e7eb' : 'none'
        }}>
          {user?.profile_image ? (
            <img
              src={user.profile_image.startsWith('http') ? user.profile_image : toAbsoluteUrl(user.profile_image)}
              alt="Profile"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '50%'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div style={{
            display: user?.profile_image ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%'
          }}>
            <User size={16} color="white" />
          </div>
        </div>
        <span style={{
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          marginRight: '0.25rem'
        }}>
          {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username}
        </span>
        <ChevronDown size={16} color="#6b7280" />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.5rem',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          minWidth: '200px',
          zIndex: 50
        }}>
          <div style={{ padding: '0.5rem' }}>
            <div style={{
              padding: '0.75rem',
              borderBottom: '1px solid #e5e7eb',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: user?.profile_image ? 'transparent' : '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '0.75rem',
                overflow: 'hidden',
                border: user?.profile_image ? '2px solid #e5e7eb' : 'none'
              }}>
                {user?.profile_image ? (
                  <img
                    src={user.profile_image.startsWith('http') ? user.profile_image : toAbsoluteUrl(user.profile_image)}
                    alt="Profile"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '50%'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div style={{
                  display: user?.profile_image ? 'none' : 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%'
                }}>
                  <User size={18} color="white" />
                </div>
              </div>
              <div>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#1f2937',
                  margin: 0
                }}>
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username}
                </p>
                <p style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  margin: 0
                }}>
                  {user?.email}
                </p>
              </div>
            </div>

            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={item.onClick}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.75rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#374151',
                    cursor: 'pointer',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                    transition: 'background-color 0.15s ease-in-out'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                  }}
                >
                  <Icon size={16} style={{ marginRight: '0.75rem' }} />
                  {item.title}
                </button>
              );
            })}

            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#ef4444',
                  cursor: 'pointer',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease-in-out'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#fef2f2';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                <LogOut size={16} style={{ marginRight: '0.75rem' }} />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDropdown;
