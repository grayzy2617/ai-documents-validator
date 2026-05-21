import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Button from '../components/Button';
import { Link } from 'react-router-dom';

const AdminHistory = () => {
    const [activeTab, setActiveTab] = useState('documents'); // documents | logs
    const [documents, setDocuments] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (activeTab === 'documents') {
                    const res = await api.get('/bgh/documents/all');
                    setDocuments(res.data);
                } else {
                    const res = await api.get('/bgh/audit-logs');
                    setLogs(res.data);
                }
            } catch (error) {
                console.error("Lỗi lấy lịch sử:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [activeTab]);

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Lịch sử & Truy vết Hệ thống (Audit Trail)</h2>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <Button variant={activeTab === 'documents' ? 'primary' : 'outline'} onClick={() => setActiveTab('documents')}>
                    Lịch sử Văn Bản
                </Button>
                <Button variant={activeTab === 'logs' ? 'primary' : 'outline'} onClick={() => setActiveTab('logs')}>
                    Nhật ký Truy vết (Logs)
                </Button>
            </div>

            {loading ? (
                <p>Đang tải dữ liệu...</p>
            ) : activeTab === 'documents' ? (
                <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa', textAlign: 'left', color: 'black' }}>
                                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>ID</th>
                                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Tên File</th>
                                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Người Nộp</th>
                                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Tổng số lỗi AI</th>
                                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Ngày tải lên</th>
                                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {documents.map((doc) => (
                                <tr key={doc.id} style={{ borderBottom: '1px solid #eee', color: 'black' }}>
                                    <td style={{ padding: '12px' }}>#{doc.id}</td>
                                    <td style={{ padding: '12px' }}><strong>{doc.original_file_name}</strong></td>
                                    <td style={{ padding: '12px' }}>{doc.owner}</td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.85em', background: doc.total_errors > 0 ? '#f8d7da' : '#d4edda', color: doc.total_errors > 0 ? '#721c24' : '#155724', fontWeight: 'bold' }}>
                                            {doc.total_errors} lỗi
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px' }}>{new Date(doc.created_at).toLocaleString('vi-VN')}</td>
                                    <td style={{ padding: '12px' }}>
                                        <Link to={`/result/${doc.id}`} style={{ color: '#0056b3', textDecoration: 'none', fontWeight: 'bold' }}>
                                            Xem Chi Tiết
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {documents.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Không có dữ liệu</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa', textAlign: 'left', color: 'black' }}>
                                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Thời gian</th>
                                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Người dùng</th>
                                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Hành động</th>
                                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Đối tượng</th>
                                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>ID Đối tượng</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id} style={{ borderBottom: '1px solid #eee', color: 'black' }}>
                                    <td style={{ padding: '12px' }}>{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                                    <td style={{ padding: '12px' }}><strong>{log.user}</strong></td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#e2e3e5', fontSize: '0.85em', fontWeight: 'bold' }}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px' }}>{log.target_table}</td>
                                    <td style={{ padding: '12px' }}>{log.target_id || '-'}</td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Chưa có nhật ký nào</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminHistory;
