import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axiosConfig';
import { toast } from 'react-toastify';
import Sidebar from './Sidebar';
import UserDropdown from './UserDropdown';
import { useOnce } from '../hooks/useOnce';
import { ArrowLeft, Save } from 'lucide-react';

const ReminderSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [daysBeforeDue, setDaysBeforeDue] = useState(10);
  const [adminEmails, setAdminEmails] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  useOnce(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/reminder-settings.php');
      if (response.data.success) {
        const data = response.data.data;
        setDaysBeforeDue(data.days_before_due);
        setAdminEmails(data.admin_emails || '');
        setIsActive(!!parseInt(data.is_active));
        setUpdatedAt(data.updated_at);
      } else {
        toast.error(response.data.message || 'Failed to load reminder settings');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load reminder settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.put('/reminder-settings.php', {
        days_before_due: parseInt(daysBeforeDue, 10),
        admin_emails: adminEmails,
        is_active: isActive ? 1 : 0
      });
      if (response.data.success) {
        toast.success('Reminder settings saved');
        fetchSettings();
      } else {
        toast.error(response.data.message || 'Failed to save reminder settings');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save reminder settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="main-container" style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar />

      <div className="main-content" style={{ flex: 1, padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.5rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#6b7280',
                  cursor: 'pointer',
                  marginRight: '1rem'
                }}
              >
                <ArrowLeft size={20} />
              </button>
              <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>
                Invoice Reminder Settings
              </h2>
            </div>
            <p style={{ color: '#6b7280' }}>
              Configure the daily internal reminder emails for recurring/proforma invoices approaching or past their due date.
            </p>
          </div>
          <div className="user-dropdown">
            <UserDropdown />
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          padding: '2rem',
          maxWidth: '640px'
        }}>
          <form onSubmit={handleSave}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Enable daily invoice due-date reminders
                </span>
              </label>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                Start reminders this many days before the due date
              </label>
              <input
                type="number"
                min="0"
                max="365"
                value={daysBeforeDue}
                onChange={(e) => setDaysBeforeDue(e.target.value)}
                style={{
                  width: '160px',
                  padding: '0.625rem 0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem'
                }}
              />
              <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                Example: 10 means reminders start 10 days before the due date (day 10, 9, 8...1, due day),
                and continue every day the invoice remains overdue afterwards.
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                Admin notification email(s)
              </label>
              <textarea
                value={adminEmails}
                onChange={(e) => setAdminEmails(e.target.value)}
                placeholder="admin1@company.com, admin2@company.com"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  resize: 'vertical'
                }}
              />
              <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                Comma-separated. These are internal reminders only — no email is ever sent to the customer.
              </p>
            </div>

            {updatedAt && (
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1.5rem' }}>
                Last updated: {new Date(updatedAt).toLocaleString()}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem 1.5rem',
                backgroundColor: saving ? '#93c5fd' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              <Save size={18} style={{ marginRight: '0.5rem' }} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReminderSettings;
