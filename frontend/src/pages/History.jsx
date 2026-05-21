import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const History = () => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/documents/history?page=${page}&size=10`);
                // Backend mới trả về { items: [...], total: X, pages: Y }
                setDocs(res.data.items || res.data); // Hỗ trợ cả 2 nếu backend chưa update
                if(res.data.pages) setTotalPages(res.data.pages);
            } catch (error) {
                console.error('Lỗi khi lấy lịch sử', error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [page]);

    return (
        <div style={{ padding: '20px' }}>
            <h2>Lịch Sử Kiểm Tra Văn Bản</h2>
            {loading ? <p>Đang tải...</p> : (
            <>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>Tên File</th>
                            <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>Ngày Upload</th>
                            <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>Trạng thái</th>
                            <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {docs.length === 0 ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>Chưa có tài liệu nào</td></tr>
                        ) : (
                            docs.map(doc => (
                                <tr key={doc.id}>
                                    <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{doc.original_file_name}</td>
                                    <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{new Date(doc.created_at).toLocaleString()}</td>
                                    <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{doc.status}</td>
                                    <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                                        <Link to={`/result/${doc.id}`} style={{ color: '#0066cc', textDecoration: 'underline' }}>Xem Lỗi</Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {totalPages > 1 && (
                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                        <button 
                            onClick={() => setPage(p => Math.max(1, p - 1))} 
                            disabled={page === 1}
                            style={{ padding: '5px 15px', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                        >
                            Trước
                        </button>
                        <span style={{ padding: '5px 15px' }}>Trang {page} / {totalPages}</span>
                        <button 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                            disabled={page === totalPages}
                            style={{ padding: '5px 15px', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                        >
                            Sau
                        </button>
                    </div>
                )}
            </>
            )}
        </div>
    );
};

export default History;