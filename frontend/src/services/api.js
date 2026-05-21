import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 300000, // Tăng lên 5 phút vì LLM xử lý có thể mất nhiều thời gian
});

// Thêm JWT Token vào Header của mọi Request
api.interceptors.request.use(
  (config) => {
    // Đọc token từ sessionStorage (cô lập theo tab)
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Xử lý tự động văng ra trang Login khi Token hết hạn (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isLoginRequest = requestUrl.includes('/login');
    if (error.response && error.response.status === 401 && !isLoginRequest) {
      sessionStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
