import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, File, AlertCircle } from 'lucide-react';
import api from '../services/api';
import Button from '../components/Button';
import './UploadDocument.css';

const UploadDocument = () => {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const onDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        validateAndSetFile(droppedFile);
    }, []);

    const onFileChange = (e) => {
        const selectedFile = e.target.files[0];
        validateAndSetFile(selectedFile);
    };

    const validateAndSetFile = (selectedFile) => {
        if (selectedFile) {
            const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (validTypes.includes(selectedFile.type)) {
                setFile(selectedFile);
                setError('');
            } else {
                setError('Vui lòng chỉ tải lên file PDF hoặc DOCX (Word).');
                setFile(null);
            }
        }
    };

    const handleUploadAndAnalyze = async () => {
        if (!file) return;

        setLoading(true);
        setError('');
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Lệnh gọi API thực tế
            const response = await api.post('/documents/check', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                }
            });
            
            // Lấy ID tài liệu được tải lên
            const documentId = response.data.document_id;
            
            if (documentId) {
                navigate(`/result/${documentId}`);
            } else {
                // Tạm thời nếu API backend không trả về ID
                alert('Upload thành công! Hãy kiểm tra trong mục danh sách tập tin.');
                navigate('/history');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || 'Lỗi khi phân tích tài liệu.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="upload-page">
            <h2 className="page-title">Kiểm Tra Rà Soát Văn Bản</h2>
            <p className="page-subtitle">Tải lên văn bản (PDF/DOCX) để AI rà soát lỗi thể thức và kỹ thuật trình bày.</p>

            <div 
                className={`dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <div className="dropzone-content">
                    <UploadCloud size={48} className="upload-icon" />
                    <h3>Kéo thả file vào đây hoặc bấm để chọn</h3>
                    <p>Hỗ trợ định dạng: .pdf, .docx</p>
                    <input 
                        type="file" 
                        id="fileInput" 
                        className="file-input" 
                        accept=".pdf,.docx" 
                        onChange={onFileChange}
                    />
                    <label htmlFor="fileInput" className="btn btn-outline" style={{marginTop: '16px'}}>
                        Chọn File
                    </label>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {file && (
                <div className="file-preview">
                    <File size={24} className="file-icon" />
                    <div className="file-info">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <Button 
                        variant="primary" 
                        onClick={handleUploadAndAnalyze}
                        disabled={loading}
                    >
                        {loading ? 'Đang Tải Lên & Phân tích...' : 'Bắt đầu kiểm tra AI'}
                    </Button>
                </div>
            )}

            {loading && (
                <div className="loading-state" style={{ marginTop: '24px', textAlign: 'center' }}>
                    <div style={{ 
                        width: '100%', 
                        height: '10px', 
                        background: '#e0e0e0', 
                        borderRadius: '5px', 
                        overflow: 'hidden',
                        marginBottom: '10px'
                    }}>
                        <div style={{ 
                            width: `${uploadProgress}%`, 
                            height: '100%', 
                            background: '#0056b3',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                    <p>Tiến trình tải lên: {uploadProgress}%</p>
                    <p style={{ color: '#0056b3', marginTop: '8px' }}>🤖 Đang tải file lên hoặc AI đang quét lỗi. Quá trình này có thể mất vài giây...</p>
                </div>
            )}
        </div>
    );
};

export default UploadDocument;
