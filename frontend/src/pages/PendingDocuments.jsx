import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';

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
      const res = await api.get('/reviewer/pending');
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
      await api.post('/bgh/batch-approve', { document_ids: selectedDocs });
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
        const res = await api.post('/report/merge', 
            { history_ids: selectedDocs },
            { responseType: 'blob' }
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

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>Văn Bản Chờ Duyệt</h2>

      {isBGH && (
        <div style={{ marginBottom: '20px' }}>
          <Button onClick={handleBatchApprove} variant="primary">
            Phê duyệt Hàng loạt ({selectedDocs.length})
          </Button>
        </div>
      )}

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
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Nguồn / Deadline</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Thời Gian</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {documents.length > 0 ? documents.map(doc => {
                return (
                <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>
                      <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => handleSelect(doc.id)} />
                  </td>
                  <td style={{ padding: '12px' }}>{doc.id}</td>
                  <td style={{ padding: '12px' }}><strong>{doc.original_file_name}</strong></td>
                  <td style={{ padding: '12px' }}>{doc.uploader || doc.owner}</td>
                  <td style={{ padding: '12px' }}>
                    {doc.deadline_title ? (
                      <span style={{ 
                        background: '#e2f0fe', 
                        color: '#0056b3', 
                        padding: '3px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.85em', 
                        fontWeight: '600',
                        border: '1px solid #b8daff',
                        display: 'inline-block'
                      }}>
                        📅 {doc.deadline_title}
                      </span>
                    ) : (
                      <span style={{ color: '#777', fontSize: '0.85em' }}>Tự kiểm tra (ad-hoc)</span>
                    )}
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