import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('docuchat_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('docuchat_token');
      localStorage.removeItem('docuchat_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
