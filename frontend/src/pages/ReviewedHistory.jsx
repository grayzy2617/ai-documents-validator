import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ReviewedHistory() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/reviewer/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(res.data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Lịch Sử Đã Duyệt</h2>
      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <div className="bg-white rounded shadow text-black overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Tên File</th>
                <th className="p-3">Người Tải Lên</th>
                <th className="p-3">Trạng Thái</th>
                <th className="p-3">Thời Gian</th>
              </tr>
            </thead>
            <tbody>
              {documents.length > 0 ? documents.map(doc => (
                <tr key={doc.id} className="border-t">
                  <td className="p-3">{doc.id}</td>
                  <td className="p-3">{doc.original_file_name}</td>
                  <td className="p-3">{doc.uploader}</td>
                  <td className="p-3 font-semibold">
                    {doc.status === 'APPROVED' ? <span className="text-green-600">Đã Duyệt</span> : 
                     doc.status === 'REJECTED' ? <span className="text-red-600">Từ Chối</span> : 
                     <span className="text-orange-600">Yêu Cầu Sửa Lại</span>}
                  </td>
                  <td className="p-3">{new Date(doc.created_at).toLocaleString('vi-VN')}</td>
                </tr>
              )) : (
                <tr><td colSpan="5" className="p-3 text-center">Không có bản lưu nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ReviewedHistory;
