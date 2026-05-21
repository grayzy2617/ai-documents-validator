import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ưu tiên đọc từ sessionStorage (cô lập theo tab)
    // Nếu không có, thử migrate từ localStorage (lần đầu sau khi cập nhật)
    let token = sessionStorage.getItem('token');
    if (!token) {
      const oldToken = localStorage.getItem('token');
      if (oldToken) {
        sessionStorage.setItem('token', oldToken);
        localStorage.removeItem('token'); // Dọn token cũ
        token = oldToken;
      }
    }

    if (token) {
      try {
        const decoded = jwtDecode(token);
        // Kiểm tra token hết hạn chưa
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          sessionStorage.removeItem('token');
          setUser(null);
        } else {
          setUser(decoded);
        }
      } catch (error) {
        sessionStorage.removeItem('token');
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const login = (token) => {
    sessionStorage.setItem('token', token);
    // Xóa token cũ trong localStorage nếu còn sót
    localStorage.removeItem('token');
    setUser(jwtDecode(token));
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) return <div>Đang tải hệ thống...</div>;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
