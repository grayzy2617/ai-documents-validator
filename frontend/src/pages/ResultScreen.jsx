import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './ResultScreen.css';
import Button from '../components/Button';
import api from '../services/api';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

const UNFIXED = ['UNFIXED'];

function normalizeSummaryPayload(data) {
    if (!data) return { summary: '', key_points: [] };
    if (typeof data === 'string') return { summary: data, key_points: [] };
    return {
        summary: data.summary || '',
        key_points: Array.isArray(data.key_points) ? data.key_points : [],
    };
}

function highlightHtml(html, snippet) {
    if (!html || !snippet || snippet.length < 4) return html;
    const plain = snippet.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!plain) return html;
    const idx = html.indexOf(plain);
    if (idx === -1) {
        const short = plain.slice(0, 30);
        if (short.length >= 4 && html.includes(short)) {
            return html.replace(short, `<mark class="error-highlight">${short}</mark>`);
        }
        return html;
    }
    return (
        html.slice(0, idx)
        + `<mark class="error-highlight">${plain}</mark>`
        + html.slice(idx + plain.length)
    );
}

function extractParagraphsFromEditor(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('p[data-para-idx]'))
        .map((p) => ({
            index: parseInt(p.getAttribute('data-para-idx'), 10),
            text: p.innerText.replace(/\u00a0/g, ' ').trim(),
        }))
        .filter((item) => !Number.isNaN(item.index));
}

const ResultScreen = () => {
    const { id } = useParams();
    const previewRef = useRef(null);

    const [errors, setErrors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [previewHtml, setPreviewHtml] = useState('');
    const [previewError, setPreviewError] = useState('');
    const [activeErrorId, setActiveErrorId] = useState(null);
    const [autofixLoading, setAutofixLoading] = useState(false);
    const [errorTab, setErrorTab] = useState('open');
    const [editMode, setEditMode] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [recheckLoading, setRecheckLoading] = useState(false);

    const [showSummary, setShowSummary] = useState(false);
    const [summaryData, setSummaryData] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState('');

    const [showFixModal, setShowFixModal] = useState(false);
    const [fixPreview, setFixPreview] = useState(null);
    const [fixLoading, setFixLoading] = useState(false);
    const [fixApplyLoading, setFixApplyLoading] = useState(false);

    const loadErrors = useCallback(async () => {
        const errRes = await api.get(`/documents/${id}/errors`);
        setErrors(errRes.data);
    }, [id]);

    const loadPreviewHtml = useCallback(async () => {
        const htmlRes = await api.get(`/documents/${id}/preview-html`);
        const html = htmlRes.data.html || '';
        setPreviewHtml(html);
        return html;
    }, [id]);

    const loadPreview = useCallback(async (fileType) => {
        if (fileType === 'pdf') {
            const fileRes = await api.get(`/documents/${id}/file`, { responseType: 'blob' });
            return URL.createObjectURL(fileRes.data);
        }
        return loadPreviewHtml();
    }, [id, loadPreviewHtml]);

    const reloadMeta = useCallback(async () => {
        const metaRes = await api.get(`/documents/${id}/meta`);
        setMeta(metaRes.data);
        return metaRes.data;
    }, [id]);

    const applyPreviewToDom = useCallback((html, error) => {
        if (!previewRef.current) return;
        const snippet = error
            ? (error.error_location || error.description || '')
            : '';
        previewRef.current.innerHTML = highlightHtml(html, snippet);
    }, []);

    useEffect(() => {
        if (!id) return;
        let objectUrl = null;

        const load = async () => {
            setLoading(true);
            setPreviewError('');
            try {
                const metaData = await reloadMeta();
                await loadErrors();
                if (metaData.file_type === 'pdf') {
                    objectUrl = await loadPreview('pdf');
                    setPdfUrl(objectUrl);
                } else {
                    await loadPreview('docx');
                }
            } catch (error) {
                console.error('Loi tai trang ket qua:', error);
                setPreviewError('Không thể tải bản xem trước văn bản.');
            } finally {
                setLoading(false);
            }
        };

        load();
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [id, loadErrors, loadPreview, reloadMeta]);

    const activeError = errors.find((e) => e.id === activeErrorId);

    useEffect(() => {
        if (meta?.file_type !== 'docx' || !previewHtml || editMode) return;
        applyPreviewToDom(previewHtml, activeError);
    }, [previewHtml, activeError, meta?.file_type, editMode, applyPreviewToDom]);

    const openErrors = errors.filter((e) => UNFIXED.includes(e.status));
    const doneErrors = errors.filter((e) => !UNFIXED.includes(e.status));
    const listErrors = errorTab === 'open' ? openErrors : doneErrors;

    const refreshAfterEdit = async () => {
        const m = await reloadMeta();
        await loadErrors();
        if (m?.file_type === 'docx') {
            const html = await loadPreviewHtml();
            applyPreviewToDom(html, null);
        }
    };

    const handleSummarize = async () => {
        setSummaryLoading(true);
        setSummaryError('');
        setSummaryData(null);
        setShowSummary(true);
        try {
            const res = await api.get(`/documents/${id}/summarize`, { timeout: 120000 });
            setSummaryData(normalizeSummaryPayload(res.data));
        } catch (err) {
            const msg = err.response?.data?.detail || err.message || 'Không thể tóm tắt văn bản.';
            setSummaryError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        } finally {
            setSummaryLoading(false);
        }
    };

    const handleAutofixAll = async () => {
        if (!window.confirm('Áp dụng sửa AI cho tất cả lỗi chưa xử lý?')) return;
        setAutofixLoading(true);
        try {
            await api.post(`/documents/${id}/autofix`);
            await refreshAfterEdit();
            alert('Đã sửa văn bản bằng AI. Bạn có thể tải file DOCX đã sửa.');
        } catch (err) {
            alert(err.response?.data?.detail || 'Autofix thất bại.');
        } finally {
            setAutofixLoading(false);
        }
    };

    const handleAiFixPreview = async (errorId) => {
        setFixLoading(true);
        setFixPreview(null);
        setShowFixModal(true);
        try {
            const res = await api.post(
                `/documents/${id}/errors/${errorId}/ai-fix/preview`,
                {},
                { timeout: 120000 },
            );
            setFixPreview(res.data);
        } catch (err) {
            setFixPreview({
                error: err.response?.data?.detail || 'Không tạo được gợi ý sửa AI.',
            });
        } finally {
            setFixLoading(false);
        }
    };

    const handleAiFixApply = async () => {
        if (!fixPreview?.error_id) return;
        setFixApplyLoading(true);
        try {
            await api.post(`/documents/${id}/errors/${fixPreview.error_id}/ai-fix/apply`, {
                search_text: fixPreview.search_text,
                replace_text: fixPreview.replace_text,
            });
            setShowFixModal(false);
            setFixPreview(null);
            await refreshAfterEdit();
        } catch (err) {
            alert(err.response?.data?.detail || 'Không áp dụng được sửa AI.');
        } finally {
            setFixApplyLoading(false);
        }
    };

    const handleSaveManualEdits = async () => {
        const paragraphs = extractParagraphsFromEditor(previewRef.current);
        if (paragraphs.length === 0) {
            alert('Không đọc được nội dung để lưu.');
            return;
        }
        setSaveLoading(true);
        try {
            await api.put(`/documents/${id}/paragraphs`, { paragraphs });
            setEditMode(false);
            await refreshAfterEdit();
            alert('Đã lưu chỉnh sửa thủ công.');
        } catch (err) {
            alert(err.response?.data?.detail || 'Lưu thất bại.');
        } finally {
            setSaveLoading(false);
        }
    };

    const handleRecheck = async () => {
        if (!window.confirm('Chạy AI kiểm tra lại trên bản văn bản hiện tại?')) return;
        setRecheckLoading(true);
        try {
            const res = await api.post(`/documents/${id}/recheck`, {}, { timeout: 180000 });
            await refreshAfterEdit();
            alert(
                `Kiểm tra lại hoàn tất.\n`
                + `Lỗi mới: ${res.data.total_errors}\n`
                + `Điểm AI: ${res.data.ai_score ?? '—'}`,
            );
        } catch (err) {
            alert(err.response?.data?.detail || 'Kiểm tra lại thất bại.');
        } finally {
            setRecheckLoading(false);
        }
    };

    const handleIgnore = async (errorId) => {
        try {
            await api.put(`/documents/errors/${errorId}/fix`, { status: 'IGNORED' });
            await loadErrors();
        } catch {
            alert('Không thể cập nhật trạng thái lỗi.');
        }
    };

    const handleManualFixed = async (errorId) => {
        try {
            await api.put(`/documents/errors/${errorId}/fix`, { status: 'MANUAL_FIXED' });
            await loadErrors();
        } catch {
            alert('Không thể đánh dấu đã sửa.');
        }
    };

    const downloadFixed = async () => {
        try {
            const response = await api.get(`/documents/${id}/autofixed_file`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute(
                'download',
                `ChuanHoa_${meta?.original_file_name || 'van_ban.docx'}`,
            );
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch {
            alert('Chưa có file đã sửa. Hãy sửa và lưu trước.');
        }
    };

    const downloadReport = async () => {
        const historyId = meta?.history_id;
        if (!historyId) {
            alert('Chưa có lịch sử kiểm tra để xuất báo cáo.');
            return;
        }
        try {
            const response = await api.get(`/report/word/${historyId}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `BaoCao_Loi_${id}.docx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch {
            alert('Không thể tải báo cáo. Vui lòng thử lại.');
        }
    };

    return (
        <div className="result-page">
            <div className="result-toolbar">
                <Button
                    variant="outline"
                    onClick={handleAutofixAll}
                    disabled={autofixLoading || openErrors.length === 0 || meta?.file_type !== 'docx'}
                >
                    {autofixLoading ? 'Đang sửa AI...' : 'Sửa tất cả bằng AI'}
                </Button>
                <Button
                    variant="primary"
                    onClick={downloadFixed}
                    disabled={!meta?.has_fixed_file}
                >
                    Tải DOCX đã sửa
                </Button>
                {meta?.file_type === 'docx' && (
                    <>
                        <Button
                            variant={editMode ? 'primary' : 'outline'}
                            onClick={() => setEditMode((v) => !v)}
                        >
                            {editMode ? 'Đang sửa (WYSIWYG)' : 'Sửa thủ công'}
                        </Button>
                        {editMode && (
                            <Button
                                variant="primary"
                                onClick={handleSaveManualEdits}
                                disabled={saveLoading}
                            >
                                {saveLoading ? 'Đang lưu...' : 'Lưu chỉnh sửa'}
                            </Button>
                        )}
                    </>
                )}
                <Button
                    variant="outline"
                    onClick={handleRecheck}
                    disabled={recheckLoading}
                >
                    {recheckLoading ? 'Đang kiểm tra lại...' : 'Kiểm tra lại'}
                </Button>
                <Button variant="outline" onClick={handleSummarize}>
                    AI Tóm tắt
                </Button>
                <Button variant="outline" onClick={downloadReport}>
                    Xuất báo cáo lỗi
                </Button>
            </div>

            <div className="result-container">
                <div className="preview-panel">
                    <div className="panel-header">
                        <h3>Bản xem trước & chỉnh sửa</h3>
                        {meta?.original_file_name && (
                            <span className="file-name-badge">{meta.original_file_name}</span>
                        )}
                        {editMode && (
                            <span className="edit-mode-badge">Chế độ chỉnh sửa — click vào đoạn văn để sửa</span>
                        )}
                    </div>
                    <div className="preview-content">
                        {previewError && <p className="preview-error">{previewError}</p>}
                        {!previewError && meta?.file_type === 'pdf' && pdfUrl && (
                            <>
                                <Document file={pdfUrl} onLoadSuccess={({ numPages: n }) => setNumPages(n)}>
                                    <Page pageNumber={pageNumber} width={420} />
                                </Document>
                                <div className="pdf-pager">
                                    <Button variant="outline" onClick={() => setPageNumber(Math.max(1, pageNumber - 1))} className="btn-sm">
                                        Trang trước
                                    </Button>
                                    <span>Trang {pageNumber} / {numPages}</span>
                                    <Button
                                        variant="outline"
                                        onClick={() => setPageNumber(Math.min(numPages || 1, pageNumber + 1))}
                                        className="btn-sm"
                                    >
                                        Trang tiếp
                                    </Button>
                                </div>
                            </>
                        )}
                        {!previewError && meta?.file_type === 'docx' && (
                            <div
                                ref={previewRef}
                                className={`docx-preview ${editMode ? 'docx-preview-editing' : ''}`}
                            />
                        )}
                        {!previewError && !meta && loading && <p>Đang tải bản xem trước...</p>}
                    </div>
                </div>

                <div className="errors-panel">
                    <div className="panel-header errors-header">
                        <h3>Kết quả rà soát (AI)</h3>
                    </div>
                    <div className="error-tabs">
                        <button type="button" className={errorTab === 'open' ? 'active' : ''} onClick={() => setErrorTab('open')}>
                            Chưa sửa ({openErrors.length})
                        </button>
                        <button type="button" className={errorTab === 'done' ? 'active' : ''} onClick={() => setErrorTab('done')}>
                            Đã xử lý ({doneErrors.length})
                        </button>
                    </div>
                    <div className="errors-list">
                        {loading ? (
                            <p>Đang tải dữ liệu...</p>
                        ) : listErrors.length === 0 ? (
                            <p className="empty-errors">
                                {errorTab === 'open' ? 'Không còn lỗi chưa xử lý.' : 'Chưa có lỗi đã xử lý.'}
                            </p>
                        ) : (
                            listErrors.map((err) => (
                                <div
                                    key={err.id}
                                    className={`error-card ${activeErrorId === err.id ? 'error-card-active' : ''}`}
                                    onClick={() => setActiveErrorId(err.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && setActiveErrorId(err.id)}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <span className="error-priority type-high">{err.error_type}</span>
                                    <p className="error-detail"><strong>Lỗi:</strong> {err.description}</p>
                                    <p className="error-suggestion"><strong>Gợi ý:</strong> {err.suggestion}</p>
                                    <p className="error-suggestion"><strong>Vị trí:</strong> {err.error_location}</p>
                                    {UNFIXED.includes(err.status) && (
                                        <div className="error-actions" onClick={(e) => e.stopPropagation()}>
                                            <Button
                                                variant="primary"
                                                className="btn-sm"
                                                onClick={() => handleAiFixPreview(err.id)}
                                            >
                                                Sửa bằng AI
                                            </Button>
                                            <Button variant="outline" className="btn-sm" onClick={() => handleManualFixed(err.id)}>
                                                Đã sửa tay
                                            </Button>
                                            <Button variant="ghost" className="btn-sm" onClick={() => handleIgnore(err.id)}>
                                                Bỏ qua
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {showFixModal && (
                <div className="summary-modal-overlay" onClick={() => setShowFixModal(false)} role="presentation">
                    <div className="summary-modal fix-diff-modal" onClick={(e) => e.stopPropagation()} role="dialog">
                        <div className="summary-modal-header">
                            <h3>Xem trước sửa AI</h3>
                            <button type="button" className="summary-close" onClick={() => setShowFixModal(false)}>×</button>
                        </div>
                        <div className="summary-modal-body">
                            {fixLoading && <p>Đang tạo gợi ý sửa...</p>}
                            {!fixLoading && fixPreview?.error && (
                                <p className="summary-error">{fixPreview.error}</p>
                            )}
                            {!fixLoading && fixPreview && !fixPreview.error && (
                                <>
                                    <div className="diff-block">
                                        <h4>Trước khi sửa</h4>
                                        <pre className="diff-text diff-before">{fixPreview.before_text}</pre>
                                    </div>
                                    <div className="diff-block">
                                        <h4>Sau khi sửa (đề xuất)</h4>
                                        <pre className="diff-text diff-after">{fixPreview.after_text}</pre>
                                    </div>
                                    <div className="fix-modal-actions">
                                        <Button variant="outline" onClick={() => setShowFixModal(false)}>Hủy</Button>
                                        <Button
                                            variant="primary"
                                            onClick={handleAiFixApply}
                                            disabled={fixApplyLoading}
                                        >
                                            {fixApplyLoading ? 'Đang áp dụng...' : 'Áp dụng sửa'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showSummary && (
                <div className="summary-modal-overlay" onClick={() => setShowSummary(false)} role="presentation">
                    <div className="summary-modal" onClick={(e) => e.stopPropagation()} role="dialog">
                        <div className="summary-modal-header">
                            <h3>AI Tóm tắt văn bản</h3>
                            <button type="button" className="summary-close" onClick={() => setShowSummary(false)}>×</button>
                        </div>
                        <div className="summary-modal-body">
                            {summaryLoading && <p>Đang phân tích văn bản...</p>}
                            {!summaryLoading && summaryError && <p className="summary-error">{summaryError}</p>}
                            {!summaryLoading && !summaryError && summaryData?.summary && (
                                <>
                                    <p className="summary-text">{summaryData.summary}</p>
                                    {summaryData.key_points?.length > 0 && (
                                        <ul className="summary-points">
                                            {summaryData.key_points.map((pt) => (
                                                <li key={pt}>{pt}</li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultScreen;
