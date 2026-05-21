import React, { useState, useEffect } from 'react';
import api from '../services/api';

const AdminRules = () => {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUpload, setShowUpload] = useState(false);
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState('');
    const [documentType, setDocumentType] = useState('Nghị định');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const fetchRules = async () => {
            try {
                // Fetch danh sách files tri thức từ backend
                const response = await api.get('/knowledge');
                setRules(response.data);
            } catch (error) {
                console.error('Lỗi khi lấy danh sách tri thức:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRules();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xoá tài liệu này khỏi hệ thống AI?")) return;
        try {
            await api.delete(`/knowledge/${id}`);
            setRules(rules.filter(r => r.id !== id));
            alert("Đã xoá tài liệu thành công!");
        } catch (error) {
            console.error('Lỗi khi xoá tri thức:', error);
            alert("Lỗi khi xoá tài liệu. Vui lòng thử lại.");
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return alert("Vui lòng chọn file");
        
        const formData = new FormData();
        formData.append("title", title);
        formData.append("document_type", documentType);
        formData.append("file", file);

        setUploading(true);
        try {
            await api.post('/knowledge/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            alert("Tải lên và xử lý tri thức thành công!");
            setShowUpload(false);
            setFile(null);
            setTitle('');
            // Reload list
            const response = await api.get('/knowledge');
            setRules(response.data);
        } catch (error) {
            console.error('Lỗi upload:', error);
            alert("Lỗi khi tải lên. Vui lòng kiểm tra lại.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>Quản lý Kho Tri Thức (Luật / Quy định cho AI)</h2>
            <button 
                onClick={() => setShowUpload(!showUpload)}
                style={{ marginBottom: '20px', padding: '8px 16px', background: showUpload ? '#6c757d' : '#0056b3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                {showUpload ? 'Đóng' : '+ Thêm tài liệu luật mới'}
            </button>

            {showUpload && (
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ddd' }}>
                    <h3 style={{ marginTop: 0 }}>Tải Lên Tài Liệu Mới</h3>
                    <form onSubmit={handleUpload}>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Tiêu đề / Tên quy định:</label>
                            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="VD: Nghị định 30/2020/NĐ-CP" />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Loại quy định:</label>
                            <select value={documentType} onChange={e => setDocumentType(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                                <option value="Nghị định">Nghị định</option>
                                <option value="Thông tư">Thông tư</option>
                                <option value="Nội quy">Nội quy</option>
                                <option value="Khác">Khác</option>
                            </select>
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>File đính kèm (PDF/DOCX):</label>
                            <input type="file" required accept=".pdf,.docx" onChange={e => setFile(e.target.files[0])} />
                        </div>
                        <button type="submit" disabled={uploading} style={{ padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                            {uploading ? 'Đang xử lý (Chờ AI nhúng)...' : 'Lưu và Xử lý'}
                        </button>
                    </form>
                </div>
            )}
            {loading ? (
                <p>Đang tải dữ liệu...</p>
            ) : (
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>ID / File Name</th>
                            <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>Trạng thái Vector Database</th>
                            <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rules.map((rule, idx) => (
                            <tr key={idx}>
                                <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{rule.filename || `Tri thức ${rule.id}`}</td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                                    <span style={{ color: 'white', background: 'green', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>Đã Nhúng AI</span>
                                </td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                                    <button onClick={() => handleDelete(rule.id)} style={{ color: 'red', border: '1px solid red', background: 'transparent', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Xoá</button>
                                </td>
                            </tr>
                        ))}
                        {rules.length === 0 && (
                            <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>Chưa có tài liệu tri thức nào</td></tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default AdminRules;