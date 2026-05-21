import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const STATUS_LABELS = {
    PENDING: 'Chờ duyệt',
    BGH_APPROVED: 'BGH đã duyệt',
    AUTO_REJECTED: 'Từ chối (AI)',
    CHECKED: 'Đã kiểm tra',
};

const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const isBGH = user?.role === 'BGH';

    const [ops, setOps] = useState(null);

    useEffect(() => {
        if (isBGH) {
            api.get('/bgh/dashboard/stats')
                .then((res) => setOps(res.data))
                .catch((err) => console.error('Lỗi lấy dữ liệu BGH:', err));
        }
    }, [isBGH]);

    return (
        <div style={{ padding: '20px' }}>
            <h2>Trang Chủ / Dashboard</h2>
            <p>Chào mừng đến với hệ thống RAG Quản lý Kiểm tra Thể thức Văn bản.</p>

            <div style={{ display: 'flex', gap: '20px', marginTop: '20px', marginBottom: '40px', flexWrap: 'wrap' }}>
                <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', flex: '1 1 280px', backgroundColor: '#f9f9f9' }}>
                    <h3>Kiểm tra ngay</h3>
                    <p>Tải lên PDF hoặc DOCX để AI rà soát thể thức.</p>
                    <Link to="/upload" style={{ display: 'inline-block', marginTop: '10px', background: '#0056b3', color: 'white', padding: '10px 15px', textDecoration: 'none', borderRadius: '4px' }}>
                        Tải văn bản lên
                    </Link>
                </div>
                <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', flex: '1 1 280px', backgroundColor: '#f9f9f9' }}>
                    <h3>Tra cứu Luật (RAG)</h3>
                    <p>Hỏi AI về quy định thể thức văn bản.</p>
                    <Link to="/search-rules" style={{ display: 'inline-block', marginTop: '10px', background: '#17a2b8', color: 'white', padding: '10px 15px', textDecoration: 'none', borderRadius: '4px' }}>
                        Tra Cứu AI
                    </Link>
                </div>
                <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', flex: '1 1 280px', backgroundColor: '#f9f9f9' }}>
                    <h3>Lịch sử rà soát</h3>
                    <p>Xem lại các văn bản đã nộp.</p>
                    <Link to="/history" style={{ display: 'inline-block', marginTop: '10px', background: '#28a745', color: 'white', padding: '10px 15px', textDecoration: 'none', borderRadius: '4px' }}>
                        Xem lịch sử
                    </Link>
                </div>
            </div>

            {isBGH && ops && (
                <div>
                    <h2 style={{ borderTop: '2px solid #eee', paddingTop: '30px' }}>📋 Bảng điều khiển vận hành văn bản (BGH)</h2>

                    <div style={{ display: 'flex', gap: '16px', marginTop: '20px', flexWrap: 'wrap' }}>
                        {[
                            { label: 'Tổng văn bản đã nộp', value: ops.total_documents, color: '#0056b3' },
                            { label: 'Chờ Tổ trưởng duyệt', value: ops.pending_review, color: '#ffc107' },
                            { label: 'BGH đã phê duyệt', value: ops.bgh_approved, color: '#28a745' },
                            { label: 'Bị từ chối (AI)', value: ops.auto_rejected, color: '#dc3545' },
                            { label: 'Nộp trong 7 ngày', value: ops.submitted_this_week, color: '#17a2b8' },
                            { label: 'Deadline quá hạn', value: ops.overdue_deadlines?.length || 0, color: '#c82333' },
                        ].map((card) => (
                            <div key={card.label} style={{ flex: '1 1 160px', padding: '16px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'center' }}>
                                <h4 style={{ margin: 0, color: '#666', fontSize: '0.9em' }}>{card.label}</h4>
                                <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '8px 0 0', color: card.color }}>{card.value}</p>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '20px', marginTop: '30px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 400px', padding: '20px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
                            <h3>Trạng thái văn bản</h3>
                            {ops.by_status?.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={ops.by_status.map((s) => ({ ...s, name: STATUS_LABELS[s.name] || s.name }))}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#0056b3" name="Số lượng" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p>Chưa có dữ liệu</p>
                            )}
                        </div>

                        <div style={{ flex: '1 1 400px', padding: '20px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
                            <h3>Theo tổ / bộ phận</h3>
                            {ops.by_department?.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={ops.by_department}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="submitted" name="Đã nộp" fill="#00C49F" />
                                        <Bar dataKey="pending" name="Chờ duyệt" fill="#FFBB28" />
                                        <Bar dataKey="approved" name="BGH duyệt" fill="#28a745" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p>Chưa có dữ liệu</p>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '300px', padding: '20px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px' }}>
                            <h3 style={{ marginTop: 0 }}>⚠️ Deadline quá hạn</h3>
                            {ops.overdue_deadlines?.length > 0 ? (
                                <ul style={{ paddingLeft: '18px', margin: 0 }}>
                                    {ops.overdue_deadlines.map((d) => (
                                        <li key={d.id} style={{ marginBottom: '8px' }}>
                                            <strong>{d.title}</strong> — {d.assigned_department} (trễ {d.days_overdue} ngày)
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ margin: 0 }}>Không có deadline quá hạn.</p>
                            )}
                            <Link to="/deadlines" style={{ display: 'inline-block', marginTop: '12px' }}>Xem lịch deadline →</Link>
                        </div>

                        <div style={{ flex: 1, minWidth: '300px', padding: '20px', background: '#e7f3ff', border: '1px solid #b8daff', borderRadius: '8px' }}>
                            <h3 style={{ marginTop: 0 }}>📅 Deadline sắp đến (7 ngày)</h3>
                            {ops.upcoming_deadlines?.length > 0 ? (
                                <ul style={{ paddingLeft: '18px', margin: 0 }}>
                                    {ops.upcoming_deadlines.map((d) => (
                                        <li key={d.id} style={{ marginBottom: '8px' }}>
                                            <strong>{d.title}</strong> — còn {d.days_remaining} ngày
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ margin: 0 }}>Không có deadline sắp đến.</p>
                            )}
                        </div>
                    </div>

                    <div style={{ marginTop: '20px', padding: '20px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ margin: 0 }}>Văn bản nộp gần đây</h3>
                            <Link to="/reviewer/pending">Quản lý chờ duyệt →</Link>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>Tên file</th>
                                    <th style={{ padding: '8px' }}>Người nộp</th>
                                    <th style={{ padding: '8px' }}>Tổ</th>
                                    <th style={{ padding: '8px' }}>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ops.recent_submissions?.map((row) => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '8px' }}>{row.original_file_name}</td>
                                        <td style={{ padding: '8px' }}>{row.owner}</td>
                                        <td style={{ padding: '8px' }}>{row.department || '—'}</td>
                                        <td style={{ padding: '8px' }}>{STATUS_LABELS[row.status] || row.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;

