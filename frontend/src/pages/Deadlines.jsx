import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import api from '../services/api';

const MAX_FILES = 3;

function Deadlines() {
    const { user } = useContext(AuthContext);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const isManager = user?.role === 'BGH' || user?.role === 'TO_TRUONG';
    const isBgh = user?.role === 'BGH';

    const [deadlines, setDeadlines] = useState([]);
    const [upcoming, setUpcoming] = useState([]);
    const [loading, setLoading] = useState(true);
    const [aiError, setAiError] = useState(null);

    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        due_date: '',
    });
    const [createFiles, setCreateFiles] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [selectedRecipients, setSelectedRecipients] = useState([]);

    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [replyNote, setReplyNote] = useState('');
    const [replyFiles, setReplyFiles] = useState([]);
    const [replySubmitting, setReplySubmitting] = useState(false);

    const [preview, setPreview] = useState(null);
    const pdfObjectUrlRef = useRef(null);

    const releasePdfUrl = () => {
        if (pdfObjectUrlRef.current) {
            URL.revokeObjectURL(pdfObjectUrlRef.current);
            pdfObjectUrlRef.current = null;
        }
    };

    const fetchDeadlines = async () => {
        try {
            const res = await api.get('/deadlines/');
            setDeadlines(res.data.items);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUpcoming = async () => {
        try {
            const res = await api.get('/deadlines/upcoming');
            setUpcoming(res.data.items);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchDeadlines();
        fetchUpcoming();
    }, []);

    useEffect(() => {
        if (!showForm || !isManager) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get('/users/');
                const list = Array.isArray(res.data) ? res.data : [];
                const mine = user?.id;
                if (!cancelled) {
                    setAllUsers(list.filter((u) => u.status !== false && u.id !== mine));
                }
            } catch (e) {
                console.error(e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [showForm, isManager, user?.id]);

    const openDetail = useCallback(async (id) => {
        setDetailLoading(true);
        setDetail(null);
        setReplyNote('');
        setReplyFiles([]);
        releasePdfUrl();
        setPreview(null);
        try {
            const res = await api.get(`/deadlines/${id}/detail`);
            setDetail(res.data);
        } catch (e) {
            alert(e.response?.data?.detail || 'Không tải được chi tiết deadline');
        } finally {
            setDetailLoading(false);
        }
    }, []);

    const openId = searchParams.get('open');
    useEffect(() => {
        if (!openId) return;
        const n = parseInt(openId, 10);
        if (!Number.isFinite(n)) return;
        openDetail(n);
    }, [openId, openDetail]);

    const closeDetail = () => {
        releasePdfUrl();
        setPreview(null);
        setDetail(null);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('open');
            return next;
        });
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (selectedRecipients.length < 1) {
            alert('Chọn ít nhất 1 username người nhận (Ctrl+Click để chọn nhiều).');
            return;
        }
        try {
            const isoDate = new Date(formData.due_date).toISOString();
            const fd = new FormData();
            fd.append('title', formData.title);
            if (formData.description) fd.append('description', formData.description);
            fd.append('due_date', isoDate);
            fd.append('recipient_usernames', JSON.stringify(selectedRecipients));
            createFiles.forEach((f) => fd.append('files', f));

            await api.post('/deadlines/', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            alert('Tạo deadline thành công');
            setShowForm(false);
            setFormData({ title: '', description: '', due_date: '' });
            setCreateFiles([]);
            setSelectedRecipients([]);
            fetchDeadlines();
            fetchUpcoming();
        } catch (err) {
            const d = err.response?.data?.detail;
            alert('Lỗi khi tạo deadline: ' + (typeof d === 'string' ? d : JSON.stringify(d) || err.message));
        }
    };

    const handleReply = async (e) => {
        e.preventDefault();
        if (!detail) return;
        setReplySubmitting(true);
        setAiError(null);
        try {
            const fd = new FormData();
            if (replyNote.trim()) fd.append('note', replyNote.trim());
            replyFiles.forEach((f) => fd.append('files', f));
            await api.post(`/deadlines/${detail.id}/reply`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            alert('Đã gửi phản hồi');
            setReplyNote('');
            setReplyFiles([]);
            await openDetail(detail.id);
            fetchDeadlines();
        } catch (err) {
            const d = err.response?.data?.detail;
            if (err.response?.status === 400 && d && typeof d === 'object' && d.errors) {
                setAiError(d);
            } else {
                alert('Lỗi phản hồi: ' + (typeof d === 'string' ? d : JSON.stringify(d) || err.message));
            }
        } finally {
            setReplySubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Xóa deadline này?')) return;
        try {
            await api.delete(`/deadlines/${id}`);
            if (detail?.id === id) closeDetail();
            fetchDeadlines();
            fetchUpcoming();
        } catch (err) {
            alert('Lỗi xóa deadline');
        }
    };

    const onPickFiles = (e, setter) => {
        const picked = Array.from(e.target.files || []);
        setter(picked.slice(0, MAX_FILES));
        e.target.value = '';
    };

    const downloadAttachment = async (attachmentId, filename) => {
        try {
            const res = await api.get(`/deadlines/attachments/${attachmentId}/download`, {
                responseType: 'blob',
            });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'file';
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert('Không tải được file');
        }
    };

    const openPreview = async (attachmentId, originalName) => {
        releasePdfUrl();
        setPreview(null);
        const ext = (originalName || '').split('.').pop()?.toLowerCase();
        try {
            if (ext === 'pdf') {
                const res = await api.get(`/deadlines/attachments/${attachmentId}/preview`, {
                    responseType: 'blob',
                });
                const url = URL.createObjectURL(res.data);
                pdfObjectUrlRef.current = url;
                setPreview({ type: 'pdf', title: originalName, url });
            } else if (ext === 'docx') {
                const res = await api.get(`/deadlines/attachments/${attachmentId}/preview`);
                setPreview({
                    type: 'html',
                    title: res.data.original_file_name || originalName,
                    html: res.data.html || '',
                });
            } else {
                alert('Chỉ xem trước được PDF và DOCX');
            }
        } catch {
            alert('Không mở được xem trước');
        }
    };

    const closePreview = () => {
        releasePdfUrl();
        setPreview(null);
    };

    if (loading) return <div style={{ padding: '20px' }}>Đang tải...</div>;

    return (
        <div style={{ padding: '20px' }}>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                }}
            >
                <h2>Quản lý Deadline</h2>
                {isManager && (
                    <Button variant="primary" onClick={() => setShowForm(!showForm)}>
                        {showForm ? 'Đóng form' : '+ Tạo Deadline mới'}
                    </Button>
                )}
            </div>

            {showForm && (
                <div
                    style={{
                        background: '#fff',
                        padding: '20px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}
                >
                    <form
                        onSubmit={handleCreate}
                        style={{ display: 'flex', flexDirection: 'column', gap: '15px', color: 'black' }}
                    >
                        <div>
                            <label>Tiêu đề (*)</label>
                            <input
                                required
                                type="text"
                                style={{ width: '100%', padding: '8px' }}
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <label>Mô tả</label>
                            <textarea
                                style={{ width: '100%', padding: '8px' }}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div>
                            <label>Hạn chót (*)</label>
                            <input
                                required
                                type="datetime-local"
                                style={{ width: '100%', padding: '8px' }}
                                value={formData.due_date}
                                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label>Người nhận (*) — chọn ít nhất 1 username (giữ Ctrl để chọn nhiều)</label>
                            <select
                                multiple
                                required
                                size={Math.min(12, Math.max(6, allUsers.length || 6))}
                                value={selectedRecipients}
                                onChange={(e) => {
                                    const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                                    setSelectedRecipients(opts);
                                }}
                                style={{ width: '100%', padding: '8px' }}
                            >
                                {allUsers.map((u) => (
                                    <option key={u.id} value={u.username}>
                                        {u.username} — {u.full_name}
                                        {u.department ? ` (${u.department})` : ''}
                                    </option>
                                ))}
                            </select>
                            <p style={{ fontSize: '13px', color: '#555' }}>
                                Đã chọn {selectedRecipients.length} người. Bạn không thể chọn chính mình.
                            </p>
                        </div>
                        <div>
                            <label>Đính kèm (tối đa {MAX_FILES} file PDF/DOCX)</label>
                            <input
                                type="file"
                                accept=".pdf,.docx"
                                multiple
                                onChange={(e) => onPickFiles(e, setCreateFiles)}
                            />
                            {createFiles.length > 0 && (
                                <p style={{ fontSize: '13px', color: '#555' }}>
                                    Đã chọn: {createFiles.map((f) => f.name).join(', ')}
                                </p>
                            )}
                        </div>
                        <Button type="submit" variant="primary" style={{ alignSelf: 'flex-start' }}>
                            Lưu Deadline
                        </Button>
                    </form>
                </div>
            )}

            {upcoming.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ color: '#dc3545' }}>Cảnh báo hạn chót sắp đến (7 ngày tới)</h3>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        {upcoming.map((d) => (
                            <div
                                key={d.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                    setSearchParams({ open: String(d.id) });
                                }}
                                onKeyDown={(ev) => {
                                    if (ev.key === 'Enter') setSearchParams({ open: String(d.id) });
                                }}
                                style={{
                                    background: '#fff',
                                    padding: '15px',
                                    borderRadius: '8px',
                                    borderLeft: '4px solid #dc3545',
                                    width: '300px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    cursor: 'pointer',
                                }}
                            >
                                <h4 style={{ margin: '0 0 10px 0', color: 'black' }}>{d.title}</h4>
                                <p style={{ margin: '5px 0', color: '#666' }}>
                                    Hạn: {new Date(d.due_date).toLocaleString('vi-VN')}
                                </p>
                                <p style={{ margin: '5px 0', color: '#666' }}>
                                    {d.recipient_count > 0
                                        ? `Người nhận: ${d.recipient_count} (username)`
                                        : `Tổ (cũ): ${d.assigned_department || 'Toàn trường'}`}
                                </p>
                                <p
                                    style={{
                                        margin: '5px 0',
                                        fontWeight: 'bold',
                                        color: d.days_left === 0 ? 'red' : 'orange',
                                    }}
                                >
                                    Còn {d.days_left} ngày
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <h3>Tất cả Deadline</h3>
            <div
                style={{
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                }}
            >
                <table
                    style={{
                        width: '100%',
                        textAlign: 'left',
                        borderCollapse: 'collapse',
                        color: 'black',
                    }}
                >
                    <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>ID</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Tiêu đề</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Hạn chót</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Người nhận</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>File gửi</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Phản hồi</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Người tạo</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {deadlines.length > 0 ? (
                            deadlines.map((doc) => (
                                <tr
                                    key={doc.id}
                                    style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                                    onClick={() => setSearchParams({ open: String(doc.id) })}
                                >
                                    <td style={{ padding: '12px' }}>{doc.id}</td>
                                    <td style={{ padding: '12px' }}>
                                        <strong>{doc.title}</strong>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {new Date(doc.due_date).toLocaleString('vi-VN')}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {doc.recipient_count > 0
                                            ? `${doc.recipient_count} người (username)`
                                            : doc.assigned_department || 'Theo tổ (cũ)'}
                                    </td>
                                    <td style={{ padding: '12px' }}>{doc.attachment_count ?? 0}</td>
                                    <td style={{ padding: '12px' }}>{doc.reply_count ?? 0}</td>
                                    <td style={{ padding: '12px' }}>{doc.created_by}</td>
                                    <td style={{ padding: '12px' }} onClick={(e) => e.stopPropagation()}>
                                        {isBgh && (
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(doc.id)}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: '#dc3545',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                Xóa
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                                    Không có deadline nào
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {(detail || detailLoading) && (
                <div className="deadline-modal-overlay" onClick={closeDetail}>
                    <div
                        className="deadline-modal-panel"
                        style={{
                            background: '#fff',
                            maxWidth: '720px',
                            width: '100%',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            padding: '24px',
                            borderRadius: '10px',
                            color: '#111',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {detailLoading && <p>Đang tải...</p>}
                        {!detailLoading && detail && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                                    <h3 style={{ marginTop: 0 }}>{detail.title}</h3>
                                    <button
                                        type="button"
                                        onClick={closeDetail}
                                        style={{
                                            border: 'none',
                                            background: '#eee',
                                            borderRadius: '6px',
                                            padding: '6px 12px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Đóng
                                    </button>
                                </div>
                                <p style={{ color: '#555' }}>
                                    Hạn: {detail.due_date ? new Date(detail.due_date).toLocaleString('vi-VN') : ''} ·
                                    Người tạo: {detail.created_by_name}
                                    {detail.uses_explicit_recipients
                                        ? ''
                                        : ` · Tổ (dữ liệu cũ): ${detail.assigned_department || 'Toàn trường'}`}
                                </p>
                                {detail.recipients && detail.recipients.length > 0 && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <strong>Người nhận:</strong>
                                        <ul style={{ margin: '6px 0 0 0' }}>
                                            {detail.recipients.map((r) => (
                                                <li key={r.id}>
                                                    {r.username} — {r.full_name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {detail.description && (
                                    <p style={{ whiteSpace: 'pre-wrap' }}>{detail.description}</p>
                                )}

                                <h4>File đính kèm (lượt gửi đầu)</h4>
                                <ul>
                                    {(detail.initial_attachments || []).map((a) => (
                                        <li key={a.id} style={{ marginBottom: '6px' }}>
                                            {a.original_file_name}{' '}
                                            <button type="button" onClick={() => openPreview(a.id, a.original_file_name)}>
                                                Xem trước
                                            </button>{' '}
                                            <button
                                                type="button"
                                                onClick={() => downloadAttachment(a.id, a.original_file_name)}
                                            >
                                                Tải xuống
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                {(detail.initial_attachments || []).length === 0 && (
                                    <p style={{ color: '#888' }}>Không có file.</p>
                                )}

                                <h4>Phản hồi người nhận</h4>
                                {(detail.replies || []).map((r) => (
                                    <div
                                        key={r.id}
                                        style={{
                                            border: '1px solid #ddd',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            marginBottom: '10px',
                                        }}
                                    >
                                        <strong>{r.author_name}</strong>
                                        <span style={{ color: '#888', marginLeft: '8px', fontSize: '13px' }}>
                                            {r.created_at ? new Date(r.created_at).toLocaleString('vi-VN') : ''}
                                        </span>
                                        {r.note && <p style={{ whiteSpace: 'pre-wrap' }}>{r.note}</p>}
                                        <ul>
                                            {(r.attachments || []).map((a) => (
                                                <li key={a.id}>
                                                    {a.original_file_name}{' '}
                                                    <button
                                                        type="button"
                                                        onClick={() => openPreview(a.id, a.original_file_name)}
                                                    >
                                                        Xem trước
                                                    </button>{' '}
                                                    <button
                                                        type="button"
                                                        onClick={() => downloadAttachment(a.id, a.original_file_name)}
                                                    >
                                                        Tải xuống
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                        {r.user_document && (
                                            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <span style={{
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.85em',
                                                    fontWeight: 'bold',
                                                    border: '1px solid',
                                                    backgroundColor: 
                                                        r.user_document.status === 'BGH_APPROVED' ? '#d4edda' :
                                                        r.user_document.status === 'REJECTED' ? '#f8d7da' :
                                                        r.user_document.status === 'NEEDS_REVISION' ? '#fff3cd' : '#e2f0fe',
                                                    color: 
                                                        r.user_document.status === 'BGH_APPROVED' ? '#155724' :
                                                        r.user_document.status === 'REJECTED' ? '#721c24' :
                                                        r.user_document.status === 'NEEDS_REVISION' ? '#856404' : '#004085',
                                                    borderColor: 
                                                        r.user_document.status === 'BGH_APPROVED' ? '#c3e6cb' :
                                                        r.user_document.status === 'REJECTED' ? '#f5c6cb' :
                                                        r.user_document.status === 'NEEDS_REVISION' ? '#ffeeba' : '#b8daff',
                                                }}>
                                                    {r.user_document.status === 'BGH_APPROVED' ? '✓ Đã phê duyệt & Đạt chuẩn' :
                                                     r.user_document.status === 'REJECTED' ? '✗ Bị từ chối' :
                                                     r.user_document.status === 'NEEDS_REVISION' ? '⚠ Yêu cầu sửa lại' : '⏱ Chờ duyệt thể thức'}
                                                </span>
                                                {isManager && r.user_document.status === 'PENDING' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            releasePdfUrl();
                                                            setPreview(null);
                                                            setDetail(null);
                                                            navigate(`/reviewer/document/${r.user_document.id}`);
                                                        }}
                                                        style={{
                                                            padding: '4px 10px',
                                                            background: '#0056b3',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            fontSize: '0.8em',
                                                            cursor: 'pointer',
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        Đến duyệt →
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(detail.replies || []).length === 0 && (
                                    <p style={{ color: '#888' }}>Chưa có phản hồi.</p>
                                )}

                                {detail.can_reply && (
                                    <form onSubmit={handleReply} style={{ marginTop: '16px' }}>
                                        <h4>Gửi phản hồi cho người gửi deadline</h4>
                                        <textarea
                                            style={{ width: '100%', minHeight: '80px', padding: '8px' }}
                                            placeholder="Ghi chú / ý kiến..."
                                            value={replyNote}
                                            onChange={(e) => setReplyNote(e.target.value)}
                                        />
                                        <div style={{ marginTop: '8px' }}>
                                            <label>Đính kèm (tối đa {MAX_FILES} file)</label>
                                            <input
                                                type="file"
                                                accept=".pdf,.docx"
                                                multiple
                                                onChange={(e) => onPickFiles(e, setReplyFiles)}
                                            />
                                            {replyFiles.length > 0 && (
                                                <p style={{ fontSize: '13px' }}>
                                                    {replyFiles.map((f) => f.name).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                        <Button type="submit" variant="primary" disabled={replySubmitting}>
                                            {replySubmitting ? 'Đang gửi...' : 'Gửi phản hồi'}
                                        </Button>
                                    </form>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {preview && (
                <div className="deadline-modal-overlay" onClick={closePreview}>
                    <div
                        style={{
                            background: '#fff',
                            width: 'min(900px, 96vw)',
                            height: 'min(85vh, 800px)',
                            padding: '12px',
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <strong>{preview.title}</strong>
                            <button type="button" onClick={closePreview}>
                                Đóng xem trước
                            </button>
                        </div>
                        {preview.type === 'pdf' && (
                            <iframe title="pdf-preview" src={preview.url} style={{ flex: 1, border: '1px solid #ccc' }} />
                        )}
                        {preview.type === 'html' && (
                            <div
                                className="docx-preview-wrap"
                                style={{
                                    flex: 1,
                                    overflow: 'auto',
                                    border: '1px solid #ccc',
                                    padding: '12px',
                                }}
                                dangerouslySetInnerHTML={{ __html: preview.html }}
                            />
                        )}
                    </div>
                </div>
            )}

            {aiError && (
                <div className="deadline-modal-overlay" onClick={() => setAiError(null)}>
                    <div
                        style={{
                            background: '#fff',
                            maxWidth: '600px',
                            width: '100%',
                            maxHeight: '85vh',
                            overflow: 'auto',
                            padding: '24px',
                            borderRadius: '10px',
                            color: '#333',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0, color: '#dc3545' }}>⚠️ Văn bản không đạt chuẩn thể thức</h3>
                            <button
                                type="button"
                                onClick={() => setAiError(null)}
                                style={{ border: 'none', background: '#eee', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Đóng
                            </button>
                        </div>
                        
                        <div style={{ padding: '15px', background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '6px', color: '#721c24', marginBottom: '15px' }}>
                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1em' }}>
                                Điểm AI đạt được: <span style={{ fontSize: '1.3em' }}>{aiError.ai_score}</span> / {aiError.min_score} điểm
                            </p>
                            <p style={{ margin: '5px 0 0 0', fontSize: '0.9em' }}>
                                Ngưỡng tối thiểu của nhà trường yêu cầu để nộp bài là {aiError.min_score} điểm.
                            </p>
                        </div>

                        <p style={{ fontWeight: 'bold' }}>Chi tiết các lỗi cần khắc phục ({aiError.errors?.length || 0} lỗi):</p>
                        <ul style={{ paddingLeft: '20px', color: '#555', fontSize: '0.95em' }}>
                            {(aiError.errors || []).map((err, index) => (
                                <li key={index} style={{ marginBottom: '10px' }}>
                                    <strong style={{ color: '#c82333' }}>{err.error_type}</strong> ({err.error_location || 'Không rõ vị trí'}): 
                                    <div style={{ marginTop: '2px', color: '#333' }}>{err.description}</div>
                                    {err.suggestion && (
                                        <div style={{ marginTop: '2px', fontStyle: 'italic', color: '#28a745' }}>
                                            👉 Gợi ý sửa: {err.suggestion}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>

                        <div style={{ marginTop: '20px', padding: '12px', background: '#e2f0fe', border: '1px solid #b8daff', borderRadius: '6px', color: '#004085', fontSize: '0.9em', lineHeight: '1.4' }}>
                            💡 <strong>Hướng dẫn:</strong> Bạn hãy truy cập vào mục <strong>[Kiểm tra văn bản]</strong> ở menu bên trái, tải file này lên để AI chấm điểm trực quan và sử dụng bộ chỉnh sửa AI (Auto-Fix/WYSIWYG) để sửa sạch lỗi. Sau đó, tải tệp đã sửa xuống và nộp lại tại đây nhé!
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .deadline-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }
      `}</style>
        </div>
    );
}

export default Deadlines;
