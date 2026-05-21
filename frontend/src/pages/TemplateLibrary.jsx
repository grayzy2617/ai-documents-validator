import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { Download, Upload, Trash2, FileText, File } from 'lucide-react';

const TemplateLibrary = () => {
    const { user } = useContext(AuthContext);
    const isBGH = user?.role === 'BGH';

    const [templates, setTemplates] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [loading, setLoading] = useState(true);

    // Upload form
    const [showUpload, setShowUpload] = useState(false);
    const [uploadData, setUploadData] = useState({ title: '', category: '', description: '' });
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const params = selectedCategory ? { category: selectedCategory } : {};
            const res = await api.get('/templates/', { params });
            setTemplates(res.data.items || []);
        } catch (err) {
            console.error('Lỗi lấy biểu mẫu:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/templates/categories');
            setCategories(res.data || []);
        } catch (err) {
            console.error('Lỗi lấy danh mục:', err);
        }
    };

    useEffect(() => {
        fetchTemplates();
        fetchCategories();
    }, [selectedCategory]);

    const handleDownload = async (id, filename) => {
        try {
            const res = await api.get(`/templates/${id}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert('Lỗi tải file: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadFile) {
            alert('Vui lòng chọn file');
            return;
        }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('title', uploadData.title);
            formData.append('category', uploadData.category);
            formData.append('description', uploadData.description);
            formData.append('file', uploadFile);

            await api.post('/templates/upload', formData);
            alert('Upload biểu mẫu thành công!');
            setShowUpload(false);
            setUploadData({ title: '', category: '', description: '' });
            setUploadFile(null);
            fetchTemplates();
            fetchCategories();
        } catch (err) {
            alert('Lỗi upload: ' + (err.response?.data?.detail || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id, title) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa biểu mẫu "${title}"?`)) {
            try {
                await api.delete(`/templates/${id}`);
                alert('Đã xóa biểu mẫu');
                fetchTemplates();
            } catch (err) {
                alert('Lỗi xóa: ' + (err.response?.data?.detail || err.message));
            }
        }
    };

    const getFileIcon = (filename) => {
        if (!filename) return <File size={32} />;
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'pdf') return <FileText size={32} color="#dc3545" />;
        if (ext === 'docx' || ext === 'doc') return <FileText size={32} color="#0056b3" />;
        if (ext === 'xlsx' || ext === 'xls') return <FileText size={32} color="#28a745" />;
        return <File size={32} />;
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>📁 Kho Biểu Mẫu</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {/* Filter */}
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                        <option value="">Tất cả danh mục</option>
                        {categories.map((cat, idx) => (
                            <option key={idx} value={cat}>{cat}</option>
                        ))}
                    </select>

                    {/* Nút Upload chỉ hiện cho BGH */}
                    {isBGH && (
                        <button
                            onClick={() => setShowUpload(!showUpload)}
                            style={{ padding: '8px 15px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                            <Upload size={16} /> Upload biểu mẫu
                        </button>
                    )}
                </div>
            </div>

            {/* Upload Form (BGH only) */}
            {showUpload && isBGH && (
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ddd' }}>
                    <h3 style={{ marginTop: 0 }}>Thêm biểu mẫu mới</h3>
                    <form onSubmit={handleUpload}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tên biểu mẫu *</label>
                                <input
                                    value={uploadData.title}
                                    onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                                    required
                                    placeholder="VD: Mẫu giáo án theo CV5512"
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Danh mục *</label>
                                <input
                                    value={uploadData.category}
                                    onChange={(e) => setUploadData({ ...uploadData, category: e.target.value })}
                                    required
                                    placeholder="VD: Giáo án, Báo cáo, Tờ trình"
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                            </div>
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Mô tả</label>
                            <textarea
                                value={uploadData.description}
                                onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                                placeholder="Mô tả ngắn về biểu mẫu..."
                                rows={2}
                                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Chọn file *</label>
                            <input type="file" accept=".pdf,.docx,.doc,.xlsx,.xls" onChange={(e) => setUploadFile(e.target.files[0])} required />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="submit" disabled={uploading} style={{ padding: '8px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                {uploading ? 'Đang upload...' : 'Lưu biểu mẫu'}
                            </button>
                            <button type="button" onClick={() => setShowUpload(false)} style={{ padding: '8px 20px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                Hủy
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Template Grid */}
            {loading ? (
                <p>Đang tải dữ liệu...</p>
            ) : templates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <FileText size={48} color="#ccc" />
                    <p style={{ color: '#999', marginTop: '10px' }}>Chưa có biểu mẫu nào trong kho.</p>
                    {isBGH && <p style={{ color: '#666' }}>Hãy bấm "Upload biểu mẫu" để thêm mới.</p>}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {templates.map((tpl) => (
                        <div key={tpl.id} style={{
                            background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', transition: 'box-shadow 0.2s',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                                {getFileIcon(tpl.original_file_name)}
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>{tpl.title}</h4>
                                    <span style={{
                                        fontSize: '0.8em', padding: '2px 8px', borderRadius: '12px',
                                        background: '#e3f2fd', color: '#1976d2'
                                    }}>{tpl.category}</span>
                                </div>
                            </div>
                            {tpl.description && (
                                <p style={{ fontSize: '0.9em', color: '#666', margin: '0 0 12px 0' }}>{tpl.description}</p>
                            )}
                            <div style={{ fontSize: '0.8em', color: '#999', marginBottom: '12px' }}>
                                📎 {tpl.original_file_name}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleDownload(tpl.id, tpl.original_file_name)}
                                    style={{
                                        flex: 1, padding: '8px', background: '#007bff', color: 'white',
                                        border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', gap: '5px', fontSize: '0.9em'
                                    }}
                                >
                                    <Download size={14} /> Tải về
                                </button>
                                {isBGH && (
                                    <button
                                        onClick={() => handleDelete(tpl.id, tpl.title)}
                                        style={{
                                            padding: '8px 12px', background: '#dc3545', color: 'white',
                                            border: 'none', borderRadius: '4px', cursor: 'pointer'
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TemplateLibrary;
