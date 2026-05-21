import React, { useState, useEffect } from 'react';
import api from '../services/api';

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
    const [formData, setFormData] = useState({
        id: '', username: '', full_name: '', email: '', password: '', role: 'GIAO_VIEN', department: '', status: true
    });

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/users');
            setUsers(response.data);
        } catch (error) {
            console.error('Lỗi khi lấy danh sách user:', error);
            alert('Lấy danh sách người dùng thất bại');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const openAddModal = () => {
        setModalMode('add');
        setFormData({ id: '', username: '', full_name: '', email: '', password: '', role: 'GIAO_VIEN', department: '', status: true });
        setShowModal(true);
    };

    const openEditModal = (user) => {
        setModalMode('edit');
        setFormData({ 
            id: user.id, 
            username: user.username, 
            full_name: user.full_name, 
            email: user.email, 
            password: '', 
            role: user.role, 
            department: user.department || '',
            status: user.status 
        });
        setShowModal(true);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'add') {
                const addData = {
                    username: formData.username,
                    full_name: formData.full_name,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role,
                    department: formData.department,
                    status: formData.status
                };
                await api.post('/users', addData);
                alert('Thêm tài khoản thành công!');
            } else {
                // Edit mode
                const updateData = {
                    full_name: formData.full_name,
                    email: formData.email,
                    role: formData.role,
                    department: formData.department,
                    status: formData.status
                };
                await api.put(`/users/${formData.id}`, updateData);
                alert('Cập nhật tài khoản thành công!');
            }
            setShowModal(false);
            fetchUsers();
        } catch (error) {
            console.error('Lỗi khi lưu user:', error);
            alert(`Lỗi: ${error.response?.data?.detail || 'Thao tác thất bại'}`);
        }
    };

    const handleDelete = async (id, username) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa tài khoản ${username}? Hành động này không thể hoàn tác.`)) {
            try {
                await api.delete(`/users/${id}`);
                alert('Đã xóa thành công!');
                fetchUsers();
            } catch (error) {
                console.error('Lỗi khi xóa:', error);
                alert('Xóa thất bại');
            }
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Quản lý Người Dùng (Ban Giám Hiệu)</h2>
                <button 
                    onClick={openAddModal}
                    style={{ padding: '10px 15px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    + Thêm tài khoản mới
                </button>
            </div>

            {loading ? (
                <p>Đang tải dữ liệu...</p>
            ) : (
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                            <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>ID</th>
                            <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Username</th>
                            <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Họ tên</th>
                            <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Vai trò</th>
                            <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Trạng thái</th>
                            <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td style={{ borderBottom: '1px solid #eee', padding: '12px' }}>{user.id}</td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '12px' }}><strong>{user.username}</strong></td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '12px' }}>{user.full_name}</td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '12px' }}>
                                    <span style={{ 
                                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.85em', fontWeight: 'bold',
                                        background: user.role === 'BGH' ? '#ffc107' : (user.role === 'TO_TRUONG' ? '#17a2b8' : '#e9ecef') 
                                    }}>
                                        {user.role === 'BGH' ? 'Ban Giám Hiệu' : user.role === 'TO_TRUONG' ? 'Tổ trưởng' : 'Giáo viên'}
                                    </span>
                                </td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '12px' }}>
                                    <span style={{ color: user.status ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                                        {user.status ? 'Hoạt động' : 'Bị khóa'}
                                    </span>
                                </td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '12px' }}>
                                    <button onClick={() => openEditModal(user)} style={{ marginRight: '8px', padding: '5px 10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Sửa</button>
                                    <button onClick={() => handleDelete(user.id, user.username)} style={{ padding: '5px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Xoá</button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>Không có dữ liệu</td></tr>
                        )}
                    </tbody>
                </table>
            )}

            {/* Modal Thêm/Sửa */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
                        <h3 style={{ marginTop: 0 }}>{modalMode === 'add' ? 'Thêm Người Dùng Mới' : 'Sửa Thông Tin User'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Tên đăng nhập (Username):</label>
                                <input name="username" value={formData.username} onChange={handleInputChange} disabled={modalMode === 'edit'} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                            </div>
                            {modalMode === 'add' && (
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px' }}>Mật khẩu:</label>
                                    <input name="password" type="password" value={formData.password} onChange={handleInputChange} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                                </div>
                            )}
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Họ và tên:</label>
                                <input name="full_name" value={formData.full_name} onChange={handleInputChange} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
                                <input name="email" type="email" value={formData.email} onChange={handleInputChange} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Phân Quyền (Role):</label>
                                <select name="role" value={formData.role} onChange={handleInputChange} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}>
                                    <option value="GIAO_VIEN">Giáo viên</option>
                                    <option value="TO_TRUONG">Tổ trưởng chuyên môn</option>
                                    <option value="BGH">Ban Giám Hiệu</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Tổ chuyên môn:</label>
                                <input name="department" value={formData.department} onChange={handleInputChange} placeholder="VD: Tổ Toán - Tin" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" name="status" checked={formData.status} onChange={handleInputChange} />
                                    Tài khoản đang hoạt động (Bỏ tick để Khóa)
                                </label>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 15px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Hủy</button>
                                <button type="submit" style={{ padding: '8px 15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Lưu thông tin</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsers;