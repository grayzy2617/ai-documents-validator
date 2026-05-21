import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

/**
 * Bảo vệ route — redirect về /login nếu chưa đăng nhập.
 * Nếu truyền prop `allowedRoles`, chỉ cho phép các role trong danh sách truy cập.
 * VD: <PrivateRoute allowedRoles={['BGH']}><AdminPage /></PrivateRoute>
 */
const PrivateRoute = ({ children, allowedRoles }) => {
  const { user } = useContext(AuthContext);

  // Chưa đăng nhập → về login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Kiểm tra role nếu có yêu cầu
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user.role || 'GIAO_VIEN';
    if (!allowedRoles.includes(userRole)) {
      // Không đủ quyền → về trang chủ
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default PrivateRoute;
