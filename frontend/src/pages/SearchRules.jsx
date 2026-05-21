import React, { useState } from 'react';
import api from '../services/api';
import { Search } from 'lucide-react';
import Button from '../components/Button';

const SearchRules = () => {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        
        setLoading(true);
        try {
            const res = await api.get(`/knowledge/search?query=${encodeURIComponent(query)}`);
            setResult(res.data);
        } catch (error) {
            console.error(error);
            const msg =
                error.response?.data?.detail ||
                error.response?.data?.message ||
                error.message;
            alert(
                typeof msg === 'string'
                    ? `Lỗi khi tìm kiếm quy định: ${msg}`
                    : 'Lỗi khi tìm kiếm quy định.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <h2>Tra cứu Quy định Thể thức bằng AI</h2>
            <p>Nhập câu hỏi hoặc từ khóa về thể thức văn bản. AI sẽ trích xuất thông tin trực tiếp từ Kho tri thức pháp luật của hệ thống.</p>
            
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <input 
                    type="text" 
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="VD: Quốc hiệu viết hoa hay viết thường? Căn lề như thế nào?" 
                    style={{ flex: 1, padding: '12px 15px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px' }}
                />
                <Button type="submit" variant="primary" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Search size={18} /> Tìm kiếm
                </Button>
            </form>

            {loading && <p style={{ marginTop: '20px' }}>Đang tra cứu cơ sở dữ liệu luật (RAG)...</p>}

            {result && !loading && (
                <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
                    <h3>Câu trả lời từ AI:</h3>
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '16px' }}>{result.answer}</p>
                    
                    <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                        <strong>Nguồn trích dẫn: </strong>
                        {result.sources && result.sources.length > 0 ? (
                            <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                                {result.sources.map((src, idx) => (
                                    <li key={idx} style={{ color: '#0056b3' }}>{src}</li>
                                ))}
                            </ul>
                        ) : (
                            <span>Không có</span>
                        )}
                    </div>

                    {result.chunks && result.chunks.length > 0 && (
                        <details style={{ marginTop: '20px' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                                Đoạn văn bản tham chiếu (chunks)
                            </summary>
                            <ol style={{ marginTop: '12px', paddingLeft: '20px', fontSize: '14px', lineHeight: 1.5 }}>
                                {result.chunks.map((c) => (
                                    <li key={c.index} style={{ marginBottom: '12px' }}>
                                        <div style={{ color: '#374151' }}>
                                            <strong>[{c.index}]</strong> {c.source}
                                            {c.title ? ` — ${c.title}` : ''}{' '}
                                            <span style={{ color: '#6b7280' }}>(điểm {c.score})</span>
                                        </div>
                                        <div style={{ whiteSpace: 'pre-wrap', marginTop: '4px', color: '#111' }}>
                                            {c.excerpt}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchRules;
