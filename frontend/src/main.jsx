import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App.jsx'
import MainLayout from './layouts/MainLayout'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import UploadDocument from './pages/UploadDocument'
import ResultScreen from './pages/ResultScreen'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import AdminRules from './pages/AdminRules'
import AdminUsers from './pages/AdminUsers'
import PendingDocuments from './pages/PendingDocuments'
import ReviewedHistory from './pages/ReviewedHistory'
import ReviewDocument from './pages/ReviewDocument'
import SearchRules from './pages/SearchRules'
import AdminHistory from './pages/AdminHistory'
import TemplateLibrary from './pages/TemplateLibrary'
import Deadlines from './pages/Deadlines'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Routes cho tất cả user đã đăng nhập */}
          <Route path="/" element={<PrivateRoute><MainLayout><Dashboard /></MainLayout></PrivateRoute>} />
          <Route path="/history" element={<PrivateRoute><MainLayout><History /></MainLayout></PrivateRoute>} />
          <Route path="/upload" element={<PrivateRoute><MainLayout><UploadDocument /></MainLayout></PrivateRoute>} />
          <Route path="/result/:id" element={<PrivateRoute><MainLayout><ResultScreen /></MainLayout></PrivateRoute>} />
          <Route path="/search-rules" element={<PrivateRoute><MainLayout><SearchRules /></MainLayout></PrivateRoute>} />
          <Route path="/templates" element={<PrivateRoute><MainLayout><TemplateLibrary /></MainLayout></PrivateRoute>} />
          <Route path="/deadlines" element={<PrivateRoute><MainLayout><Deadlines /></MainLayout></PrivateRoute>} />

          {/* Admin Routes — chỉ BGH */}
          <Route path="/admin/rules" element={<PrivateRoute allowedRoles={['BGH']}><MainLayout><AdminRules /></MainLayout></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute allowedRoles={['BGH']}><MainLayout><AdminUsers /></MainLayout></PrivateRoute>} />
          <Route path="/admin/history" element={<PrivateRoute allowedRoles={['BGH']}><MainLayout><AdminHistory /></MainLayout></PrivateRoute>} />

          {/* Reviewer Routes — BGH + Tổ trưởng */}
          <Route path="/reviewer/pending" element={<PrivateRoute allowedRoles={['BGH', 'TO_TRUONG']}><MainLayout><PendingDocuments /></MainLayout></PrivateRoute>} />
          <Route path="/reviewer/history" element={<PrivateRoute allowedRoles={['BGH', 'TO_TRUONG']}><MainLayout><ReviewedHistory /></MainLayout></PrivateRoute>} />
          <Route path="/reviewer/document/:id" element={<PrivateRoute allowedRoles={['BGH', 'TO_TRUONG']}><MainLayout><ReviewDocument /></MainLayout></PrivateRoute>} />

          {/* Catch-all: redirect về trang chủ */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
