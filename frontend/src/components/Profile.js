import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api, { toAbsoluteUrl } from '../utils/axiosConfig';
import { toast } from 'react-toastify';
import Sidebar from './Sidebar';
import UserDropdown from './UserDropdown';
import { useOnce } from '../hooks/useOnce';
import { 
  ArrowLeft,
  Camera,
  Save,
  User
} from 'lucide-react';

const Profile = () => {
  const { updateUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    id: '',
    username: '',
    email: '',
    role: '',
    profile_image: '',
    first_name: '',
    last_name: '',
    phone: '',
    created_at: '',
    updated_at: ''
  });
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: ''
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useOnce(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/profile.php');
      if (response.data.success) {
        setProfile(response.data.data);
        setFormData({
          first_name: response.data.data.first_name || '',
          last_name: response.data.data.last_name || '',
          phone: response.data.data.phone || ''
        });
        const profileImage = response.data.data.profile_image;
        setImagePreview(profileImage ? 
          (profileImage.startsWith('http') ? profileImage : toAbsoluteUrl(profileImage)) 
          : null
        );
        } else {
        }
    } catch (error) {
      toast.error('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!selectedFile) return;

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await api.post('/upload.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        const imageUrl = response.data.image_url.startsWith('http') 
          ? response.data.image_url 
          : toAbsoluteUrl(response.data.image_url);
        
        setProfile(prev => ({
          ...prev,
          profile_image: response.data.image_url
        }));
        setImagePreview(imageUrl);
        setSelectedFile(null);
        
        // Update user context with new profile image
        updateUser({
          profile_image: response.data.image_url
        });
        
        // Also refresh user data from server to ensure consistency
        await refreshUser();
        
        toast.success('Profile image updated successfully!');
      } else {
        toast.error(response.data.message || 'Upload failed');
      }
    } catch (error) {
      toast.error('Failed to upload image');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await api.put('/profile.php', {
        ...formData,
        profile_image: profile.profile_image
      });

      if (response.data.success) {
        setProfile(prev => ({
          ...prev,
          ...formData
        }));
        
        // Update user context with new profile data
        updateUser({
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone
        });
        
        toast.success('Profile updated successfully');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e2e8f0',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

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
        <div style={{ marginBottom: '2rem' }}>
          <div className="header-section" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '1rem' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
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
              <h2 style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: '#1f2937'
              }}>
                Profile Settings
              </h2>
            </div>
            <div className="user-dropdown">
              <UserDropdown />
            </div>
          </div>
          <p style={{ color: '#6b7280' }}>
            Manage your personal information and profile picture.
          </p>
        </div>

        <div className="profile-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '2rem' 
        }}>
          {/* Profile Image Section */}
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            height: 'fit-content'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '1.5rem'
            }}>
              Profile Picture
            </h3>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                overflow: 'hidden',
                position: 'relative'
              }}>
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Profile"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <User size={48} color="#9ca3af" />
                )}
              </div>
              
              <input
                type="file"
                id="image-upload"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
              
              <label
                htmlFor="image-upload"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem'
                }}
              >
                <Camera size={16} style={{ marginRight: '0.5rem' }} />
                Choose Image
              </label>
              
              {selectedFile && (
                <button
                  onClick={handleImageUpload}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Upload Image
                </button>
              )}
            </div>
          </div>

          {/* Profile Form Section */}
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '1.5rem'
            }}>
              Personal Information
            </h3>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    backgroundColor: '#f9fafb',
                    color: '#6b7280'
                  }}
                />
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Email cannot be changed
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: saving ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '500'
                  }}
                >
                  <Save size={20} style={{ marginRight: '0.5rem' }} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                
                <button
                  type="button"
                  onClick={async () => {
                    await refreshUser();
                    toast.success('User data refreshed!');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '500'
                  }}
                >
                  Refresh Data
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
