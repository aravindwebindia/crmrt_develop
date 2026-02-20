import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { Eye, EyeOff, User, Lock, AlertCircle } from 'lucide-react';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const { login } = useAuth();

  // No initial validation - errors only show after user interaction

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Real-time validation for password field
    if (name === 'password') {
      // Mark field as touched
      setTouched(prev => ({ ...prev, password: true }));
      
      const newErrors = { ...errors };
      
      if (!value) {
        // Field is empty - show required error only if touched
        if (touched.password) {
          newErrors.password = 'Password is required';
        }
      } else if (value.length < 6) {
        // Field is too short
        newErrors.password = 'Password must be at least 6 characters';
      } else {
        // Field is valid - clear error
        delete newErrors.password;
      }
      
      setErrors(newErrors);
    }
  };

  // Real-time validation for username/email field
  const handleUsernameChange = (e) => {
    const { value } = e.target;
    setFormData({
      ...formData,
      username: value
    });
    
    // Mark field as touched
    setTouched(prev => ({ ...prev, username: true }));
    
    // Real-time validation only after field is touched
    const newErrors = { ...errors };
    
    if (!value.trim()) {
      // Field is empty - show required error only if touched
      if (touched.username) {
        newErrors.username = 'Username or email is required';
      }
    } else if (value.trim().length < 3) {
      // Field is too short
      newErrors.username = 'Username must be at least 3 characters';
    } else if (isEmailFormat(value.trim()) && !isValidEmail(value.trim())) {
      // Invalid email format
      newErrors.username = 'Please enter a valid email address';
    } else {
      // Field is valid - clear error
      delete newErrors.username;
    }
    
    setErrors(newErrors);
  };

  // Email validation function
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if input looks like an email
  const isEmailFormat = (input) => {
    return input.includes('@') && input.includes('.');
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Username/Email validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username or email is required';
    } else if (formData.username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (isEmailFormat(formData.username.trim()) && !isValidEmail(formData.username.trim())) {
      newErrors.username = 'Please enter a valid email address';
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      toast.error('Please fix the errors below');
      return;
    }
    
    setLoading(true);
    setErrors({});

    try {
      const result = await login(formData.username, formData.password);
      
      if (result.success) {
        toast.success('Login successful!');
        // Reset form on successful login
        setFormData({
          username: '',
          password: ''
        });
      } else {
        toast.error(result.message || 'Login failed');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '1rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            Webindia CRM
          </h1>
          <p style={{ color: '#6b7280' }}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Username or Email
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }}>*</span>
              </label>
            <div style={{ position: 'relative' }}>
              <User style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                width: '1.25rem',
                height: '1.25rem'
              }} />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleUsernameChange}
                    placeholder="Enter username or email"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                      border: `1px solid ${errors.username ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.15s ease-in-out',
                      backgroundColor: errors.username ? '#fef2f2' : 'white'
                    }}
                    onFocus={(e) => e.target.style.borderColor = errors.username ? '#dc2626' : '#3b82f6'}
                    onBlur={(e) => {
                      e.target.style.borderColor = errors.username ? '#dc2626' : '#d1d5db';
                      // Mark field as touched
                      setTouched(prev => ({ ...prev, username: true }));
                      // Validate on blur to catch empty fields
                      if (!formData.username.trim()) {
                        setErrors(prev => ({
                          ...prev,
                          username: 'Username or email is required'
                        }));
                      }
                    }}
                  />
            </div>
            {errors.username && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: '0.25rem',
                fontSize: '0.75rem',
                color: '#dc2626'
              }}>
                <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                {errors.username}
              </div>
            )}
            {formData.username && !errors.username && isEmailFormat(formData.username) && isValidEmail(formData.username) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: '0.25rem',
                fontSize: '0.75rem',
                color: '#10b981'
              }}>
                <div style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '0.25rem'
                }}>
                  <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                </div>
                Valid email format
              </div>
            )}
          </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Password
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }}>*</span>
              </label>
            <div style={{ position: 'relative' }}>
              <Lock style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                width: '1.25rem',
                height: '1.25rem'
              }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem 2.5rem 0.75rem 2.5rem',
                      border: `1px solid ${errors.password ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.15s ease-in-out',
                      backgroundColor: errors.password ? '#fef2f2' : 'white'
                    }}
                    onFocus={(e) => e.target.style.borderColor = errors.password ? '#dc2626' : '#3b82f6'}
                    onBlur={(e) => {
                      e.target.style.borderColor = errors.password ? '#dc2626' : '#d1d5db';
                      // Mark field as touched
                      setTouched(prev => ({ ...prev, password: true }));
                      // Validate on blur to catch empty fields
                      if (!formData.password) {
                        setErrors(prev => ({
                          ...prev,
                          password: 'Password is required'
                        }));
                      }
                    }}
                  />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: '0.25rem',
                fontSize: '0.75rem',
                color: '#dc2626'
              }}>
                <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                {errors.password}
              </div>
            )}
            {formData.password && !errors.password && formData.password.length >= 6 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: '0.25rem',
                fontSize: '0.75rem',
                color: '#10b981'
              }}>
                <div style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '0.25rem'
                }}>
                  <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                </div>
                Password meets requirements
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease-in-out'
            }}
            onMouseOver={(e) => {
              if (!loading) e.target.style.backgroundColor = '#2563eb';
            }}
            onMouseOut={(e) => {
              if (!loading) e.target.style.backgroundColor = '#3b82f6';
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
