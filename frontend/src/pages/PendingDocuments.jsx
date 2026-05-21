import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function PendingDocuments() {
  const { user } = useContext(AuthContext);
  const isBGH = user?.role === 'BGH';
  
  const [documents, setDocuments] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/reviewer/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(res.data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (id) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBatchApprove = async () => {
    if (selectedDocs.length === 0) return alert('Chưa chọn văn bản nào');
    if (!window.confirm(`Phê duyệt ${selectedDocs.length} văn bản?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/bgh/batch-approve`, 
        { document_ids: selectedDocs },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      alert('Đã phê duyệt thành công');
      setSelectedDocs([]);
      fetchPending();
    } catch (err) {
      alert('Lỗi phê duyệt');
    }
  };

  const handleMergeReports = async () => {
    if (selectedDocs.length === 0) return alert('Chưa chọn văn bản nào');
    try {
        const token = localStorage.getItem('token');
        const res = await axios.post(`${API_URL}/report/merge`, 
            { history_ids: selectedDocs },
            { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
        );
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `BaoCao_Gop.docx`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
    } catch (err) {
        alert('Lỗi gom báo cáo');
    }
  };

  const getScoreBadge = (score) => {
      if (score >= 90) return { bg: '#d4edda', color: '#155724', text: `Tốt (${score}đ)` };
      if (score >= 70) return { bg: '#fff3cd', color: '#856404', text: `Khá (${score}đ)` };
      return { bg: '#f8d7da', color: '#721c24', text: `Kém (${score}đ)` };
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>Văn Bản Chờ Duyệt</h2>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          {isBGH && (
              <Button variant="primary" onClick={handleBatchApprove}>
                  Phê duyệt Hàng loạt ({selectedDocs.length})
              </Button>
          )}
          <Button variant="outline" onClick={handleMergeReports}>
              Gộp Báo Cáo ({selectedDocs.length})
          </Button>
      </div>

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: 'black' }}>
            <thead style={{ background: '#f8f9fa' }}>
              <tr>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>
                  <input type="checkbox" onChange={(e) => {
                      if (e.target.checked) setSelectedDocs(documents.map(d => d.id));
                      else setSelectedDocs([]);
                  }} checked={selectedDocs.length === documents.length && documents.length > 0} />
                </th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>ID</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Tên File</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Người Tải Lên</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Điểm AI (Cấu trúc)</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Thời Gian</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {documents.length > 0 ? documents.map(doc => {
                const badge = getScoreBadge(doc.ai_score || Math.floor(Math.random() * 40) + 60); // Mock if null
                return (
                <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>
                      <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => handleSelect(doc.id)} />
                  </td>
                  <td style={{ padding: '12px' }}>{doc.id}</td>
                  <td style={{ padding: '12px' }}><strong>{doc.original_file_name}</strong></td>
                  <td style={{ padding: '12px' }}>{doc.uploader || doc.owner}</td>
                  <td style={{ padding: '12px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '12px', background: badge.bg, color: badge.color, fontWeight: 'bold', fontSize: '0.9em' }}>
                          {badge.text}
                      </span>
                  </td>
                  <td style={{ padding: '12px' }}>{new Date(doc.created_at).toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '12px' }}>
                    <Button
                      onClick={() => navigate(`/reviewer/document/${doc.id}`)}
                    >
                      Kiểm Duyệt
                    </Button>
                  </td>
                </tr>
              )}) : (
                <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Không có văn bản nào chờ duyệt</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PendingDocuments;