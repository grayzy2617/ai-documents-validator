import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ReviewDocument() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewComments, setReviewComments] = useState("");
  
  // State cho form thêm lỗi thủ công
  const [showAddErrorForm, setShowAddErrorForm] = useState(false);
  const [newError, setNewError] = useState({
    error_type: '',
    error_location: '',
    description: '',
    suggestion: ''
  });

  useEffect(() => {
    fetchReviewData();
  }, [id]);

  const fetchReviewData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/reviewer/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
      alert('Không thể tải chi tiết');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateError = async (errorId, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/reviewer/errors/${errorId}`, 
        { status }, 
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      // Update local state
      setData(prev => {
        const newErrors = prev.errors.map(e => e.id === errorId ? { ...e, status } : e);
        return { ...prev, errors: newErrors };
      });
    } catch(err) {
      console.error(err);
      alert('Lỗi cập nhật');
    }
  };

  const handleAddManualError = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/reviewer/documents/${id}/errors`, 
        newError, 
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      // Cập nhật giao diện với lỗi mới vừa thêm
      setData(prev => ({
        ...prev,
        errors: [...prev.errors, res.data]
      }));
      
      // Reset form
      setNewError({ error_type: '', error_location: '', description: '', suggestion: '' });
      setShowAddErrorForm(false);
      alert('Đã thêm lỗi thủ công thành công!');
    } catch(err) {
      console.error(err);
      alert('Lỗi khi thêm lỗi thủ công');
    }
  };

  const handleFinalReview = async (statusAction) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/reviewer/documents/${id}/review`, 
        { review_status: statusAction, comments: reviewComments }, 
        { headers: { Authorization: `Bearer ${token}` }}
      );
      alert('Kiểm duyệt thành công');
      navigate('/reviewer/pending');
    } catch(err) {
      console.error(err);
      alert('Lỗi khi duyệt văn bản');
    }
  };

  if (loading) return <div>Đang tải...</div>;
  if (!data) return <div>Không có dữ liệu</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Chi Tiết Kiểm Duyệt: {data.document.filename}</h2>
      <div className="bg-white p-4 rounded shadow mb-6 text-black">
        <p><strong>Người Tải Lên:</strong> {data.document.uploader}</p>
        <p><strong>Trạng Thái:</strong> {data.document.status}</p>
      </div>

      <h3 className="text-xl font-bold mb-2">Danh sách lỗi AI phát hiện</h3>
      <div className="space-y-4 mb-8">
         {data.errors.length > 0 ? data.errors.map(err => (
            <div key={err.id} className="bg-white p-4 rounded shadow text-black border-l-4 border-red-500">
               <p className="font-bold">Lỗi: {err.error_type}</p>
               <p><strong>Mô tả:</strong> {err.description}</p>
               {err.content_extracted && <p><strong>Nội dung trích xuất:</strong> "{err.content_extracted}"</p>}
               <p><strong>Gợi ý AI:</strong> {err.suggestion}</p>
               <div className="mt-4 flex gap-2 items-center">
                  <span className="font-semibold text-gray-700">Đánh giá của Reviewer:</span>
                  <button 
                    onClick={() => handleUpdateError(err.id, 'VERIFIED')}
                    className={`px-3 py-1 rounded ${err.status === 'VERIFIED' ? 'bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                  >Ai nói Đúng</button>
                  <button 
                    onClick={() => handleUpdateError(err.id, 'IGNORED')}
                    className={`px-3 py-1 rounded ${err.status === 'IGNORED' ? 'bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                  >Ai nói Sai (Bỏ qua)</button>
               </div>
            </div>
         )) : <p>Văn bản này không có lỗi nào do AI tìm ra.</p>}
      </div>

      <div className="bg-white p-4 rounded shadow text-black mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Thêm Lỗi Thủ Công</h3>
          <button 
            onClick={() => setShowAddErrorForm(!showAddErrorForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {showAddErrorForm ? 'Đóng Form' : '+ Thêm Lỗi'}
          </button>
        </div>
        
        {showAddErrorForm && (
          <form onSubmit={handleAddManualError} className="space-y-4 border-t pt-4">
            <div>
              <label className="block font-bold mb-1">Loại lỗi (*)</label>
              <input required type="text" className="w-full border p-2 rounded" placeholder="VD: Sai thụt lề, Thiếu quốc hiệu..."
                value={newError.error_type} onChange={e => setNewError({...newError, error_type: e.target.value})} />
            </div>
            <div>
              <label className="block font-bold mb-1">Vị trí</label>
              <input type="text" className="w-full border p-2 rounded" placeholder="VD: Dòng 3 Trang 1"
                value={newError.error_location} onChange={e => setNewError({...newError, error_location: e.target.value})} />
            </div>
            <div>
              <label className="block font-bold mb-1">Mô tả chi tiết (*)</label>
              <textarea required className="w-full border p-2 rounded" placeholder="Mô tả cụ thể lỗi này là gì..."
                value={newError.description} onChange={e => setNewError({...newError, description: e.target.value})} />
            </div>
            <div>
              <label className="block font-bold mb-1">Gợi ý sửa</label>
              <textarea className="w-full border p-2 rounded" placeholder="Gợi ý cách sửa cho tác giả..."
                value={newError.suggestion} onChange={e => setNewError({...newError, suggestion: e.target.value})} />
            </div>
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700">Lưu Lỗi</button>
          </form>
        )}
      </div>

      <div className="bg-white p-4 rounded shadow text-black">
         <h3 className="text-xl font-bold mb-4">Kết Luận Của Reviewer</h3>
         <textarea 
            className="w-full border p-2 mb-4 rounded" 
            rows="3" 
            placeholder="Nhận xét chung..." 
            value={reviewComments}
            onChange={(e) => setReviewComments(e.target.value)}
         ></textarea>
         <div className="flex gap-4">
            <button onClick={() => handleFinalReview('APPROVED')} className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 font-bold">✅ Phê Duyệt</button>
            <button onClick={() => handleFinalReview('NEEDS_REVISION')} className="bg-orange-500 text-white px-4 py-2 rounded shadow hover:bg-orange-600 font-bold">⚠️ Yêu Cầu Sửa Lại</button>
            <button onClick={() => handleFinalReview('REJECTED')} className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 font-bold">❌ Từ Chối</button>
         </div>
      </div>
    </div>
  );
}

export default ReviewDocument;
