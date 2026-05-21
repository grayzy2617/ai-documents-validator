import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, CheckSquare, Settings, CheckCircle, FileClock, Search, FolderDown, FileStack, CalendarDays } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
    // Lấy thông tin user từ AuthContext
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'BGH';
    const isReviewer = user?.role === 'TO_TRUONG' || user?.role === 'BGH'; // BGH cũng có thể duyệt

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <h2>RAG QLDA</h2>
            </div>
            <nav className="sidebar-nav">
                <NavLink to="/" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
                    <LayoutDashboard size={20} />
                    <span>Trang Chủ</span>
                </NavLink>

                <NavLink to="/upload" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
                    <FileText size={20} />
                    <span>Kiểm Tra Văn Bản</span>
                </NavLink>

                <NavLink to="/search-rules" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
                    <Search size={20} />
                    <span>Tra Cứu Quy Định</span>
                </NavLink>

                <NavLink to="/templates" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
                    <FolderDown size={20} />
                    <span>Kho Biểu Mẫu</span>
                </NavLink>

                <NavLink to="/deadlines" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
                    <CalendarDays size={20} />
                    <span>Lịch Deadline</span>
                </NavLink>

                {/* Thêm lịch sử kiểm tra của user hiện tại (nếu có trang /history) */}
                <NavLink to="/history" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
                    <FileClock size={20} />
                    <span>Lịch Sử Của Tôi</span>
                </NavLink>

                {isReviewer && (
                    <>
                        <div className="nav-divider">KIỂM DUYỆT</div>
                        <NavLink to="/reviewer/pending" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
                            <CheckSquare size={20} />
                            <span>Văn Bản Chờ Duyệt</span>
                        </NavLink>
                        <NavLink to="/reviewer/history" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
                            <CheckCircle size={20} />
                            <span>Lịch Sử Đã Duyệt</span>
                        </NavLink>
                    </>
                )}

                {isAdmin && (
                    <>
                        <div className="nav-divider">QUẢN TRỊ</div>
                        <NavLink to="/admin/rules" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
                            <CheckSquare size={20} />
                            <span>Kho Tri Thức</span>
                        </NavLink>
                        <NavLink to="/admin/history" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
                            <FileClock size={20} />
                            <span>Lịch Sử Toàn Hệ Thống</span>
                        </NavLink>
                        <NavLink to="/admin/users" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
                            <Settings size={20} />
                            <span>Quản Lý Users</span>
                        </NavLink>
                    </>
                )}
            </nav>
        </aside>
    );
};

export default Sidebar;
