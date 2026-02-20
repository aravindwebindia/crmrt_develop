import axios from 'axios';
import UnifiedConfig from '../config/unified';

// Create axios instance with dynamic base URL
const api = axios.create({
	timeout: 30000,
});

// Interceptor to set dynamic base URL
api.interceptors.request.use(async (config) => {
  if (!config.baseURL) {
    config.baseURL = await UnifiedConfig.getApiBaseUrl();
  }
  return config;
});

// Helper to create absolute URLs for assets
export const toAbsoluteUrl = async (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  
  const assetBase = await UnifiedConfig.getAssetBaseUrl();
  const isUpload = path.includes('uploads/');
  const baseUrl = isUpload ? await UnifiedConfig.getBackendUrl() : assetBase;
  const cleanPath = path.replace(/^\//, '');
  return `${baseUrl.replace(/\/$/, '')}/${cleanPath}`;
};

// Token refresh functionality removed

// Request interceptor to add token to all requests
api.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem('token');
		if (token) {
      config.headers = config.headers || {};

      // Axios v1 may use AxiosHeaders with .set()
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// Response interceptor - token refresh disabled
api.interceptors.response.use(
	(response) => {
		return response;
	},
	async (error) => {
		// TEMPORARILY DISABLED: Don't redirect automatically, just log the error
		if (error.response?.status === 401) {
			}
		return Promise.reject(error);
	}
);

export default api;
