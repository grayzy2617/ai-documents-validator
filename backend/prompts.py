from langchain_core.prompts import PromptTemplate

# Prompt dùng để trích xuất luật quy định từ Vector DB
RAG_RETRIEVAL_PROMPT = """Bạn là một chuyên gia về quy định thể thức văn bản hành chính nhà nước. 
Dựa vào tài liệu chuẩn mực sau đây (ngữ cảnh):
{context}

Hãy trả lời cho câu hỏi: Quy định chuẩn cho trường hợp sau là gì?
{question}
"""

# Prompt dùng để kiểm tra lỗi của văn bản
DOCUMENT_CHECK_PROMPT = """Bạn là một Chuyên gia Kiểm thử (Senior QA) kiểm duyệt lỗi thể thức văn bản hành chính theo quy định.

Dưới đây là các Trích đoạn Quy định chuẩn (Knowledge Base):
{context}

Dưới đây là Nội dung văn bản cần kiểm tra:
{document_content}

Nhiệm vụ của bạn:
1. Đối chiếu "Nội dung văn bản" với "Trích đoạn Quy định chuẩn".
2. BẮT BUỘC CHÚ Ý KHAI BÁO THIẾU: Bất kỳ trường thông tin nào CÒN TRỐNG và CHỈ CÓ các dấu chấm (.......), dấu gạch dưới (_______) mà chưa được điền dữ liệu thật (Ví dụ: "Địa danh, ngày ….. tháng …… năm …..", hoặc "Hiệu trưởng Trường .............................;") thì đó là lỗi "Thiếu thông tin kê khai bắt buộc".
u   - LƯU Ý QUAN TRỌNG: Nếu chỗ có dấu chấm/chấm lửng (...) đã ĐƯỢC ĐIỀN CHÈN THÊM THÔNG TIN vào (Ví dụ: "Hiệu trưởng Trường (nơi đi)........Trần Nguyễn Văn Phát..............;", hoặc "- Hiệu trưởng Trường (nơi đến)…Trần Văn Tèo.......,", hoặc "Thành Phố..Hà Nội..") thì XEM NHƯ ĐÚNG, KHÔNG ĐƯỢC TÍNH ĐÓ LÀ LỖI. Dù còn dư dấu chấm trước hoặc sau đoạn chữ cũng không tính là lỗi. Chỉ bắt lỗi khi nó CHỈ CÓ dấu chấm mà KHÔNG CÓ chữ cái/thông tin nào xen vào.
3. KIỂM TRA MÀU SẮC VÀ ĐỊNH DẠNG: Mã nguồn đã quét cực kỳ chi tiết và gắn thẻ mô tả vào đầu dòng (Ví dụ: `[font="Times New Roman" size="14.0pt" color="#FF0000" bold="true"]`).
   - MÀU CHỮ: Nếu phát hiện thẻ màu đỏ (`color="#FF0000"`) hoặc bất kỳ màu nào khác chữ đen tiêu chuẩn ở những chỗ điền tên/thông tin (VD: Trần Nguyễn Văn Phát), hãy bắt lỗi lập tức "Sai màu chữ (Bắt buộc dùng mực đen)".
   - CỠ CHỮ & FONT: Thường phải là Times New Roman, size 13pt-14pt. Nếu quá nhỏ/lớn là "Sai cỡ chữ".
   - IN ĐẬM/NGHIÊNG: Nếu tên người điền vào hoặc thông tin điền tay bị bôi đậm (bold="true") sai quy định, cũng hãy chỉ ra lỗi đó.
4. Tìm ra TẤT CẢ các lỗi vi phạm về thể thức. (ví dụ: sai lề, sai màu chữ đỏ, lạm dụng in đậm, sai cỡ chữ, sai cách viết hoa, sai chính tả, thiếu quốc hiệu, và các lỗi khác).
5. Trả về kết quả dưới định dạng JSON chính xác với cấu trúc sau (không bao gồm markdown block như ```json):
[
    {{
        "error_type": "Tên loại lỗi (VD: Sai màu chữ đỏ, Lỗi bôi đậm sai chỗ, Thiếu thông tin,...)",
        "error_location": "Trích xuất CHÍNH XÁC chuỗi chữ nguyên bản gây lỗi (chỉ chữ, KHÔNG chứa thẻ tag [font...]) để hệ thống bôi đỏ trên file PDF.",
        "description": "Mô tả chi tiết vi phạm theo góc nhìn của chuyên gia QA (VD: Bạn đã bôi đỏ tên..., thể thức bắt buộc phải dùng mực đen).",
        "suggestion": "Cách sửa lại cho đúng",
        "status": "UNFIXED"
    }}
]

Nếu không có bất kỳ lỗi nào, hãy trả về một mảng rỗng `[]`.
Lưu ý: Bạn BẮT BUỘC chỉ được dựa vào "Trích đoạn Quy định chuẩn" được cho ở trên để bắt lỗi, không được tự bịa ra luật. 
"""

DOCUMENT_CHECK_TEMPLATE = PromptTemplate(
    input_variables=["context", "document_content"],
    template=DOCUMENT_CHECK_PROMPT
)

AUTOFIX_PLAN_PROMPT = """Bạn là một hệ thống AutoFix thông minh chuyên sửa lỗi thể thức văn bản (.docx).
Dưới đây là một phần hoặc toàn bộ nội dung của văn bản (đã loại bỏ định dạng phức tạp):
{document_content}

Dưới đây là danh sách các lỗi vi phạm thể thức đã được AI khác và Kiểm duyệt viên xác nhận:
{errors_json}

Hãy lập một kế hoạch sửa lỗi (AutoFix Plan) thật chính xác dưới dạng JSON array.
Mỗi phần tử trong array là một thao tác TÌM và THAY THẾ trên một đoạn văn bản (paragraph) cụ thể.
Các key BẮT BUỘC có:
- "search_text": Trích đoạn văn bản nguyên gốc TỒN TẠI trong văn bản để hệ thống dùng làm khóa tìm kiếm (lấy một đoạn text hoặc cả dòng). Chú ý không được bịa ra text không có trong văn bản gốc.
- "replace_text": Đoạn văn bản mới đã được sửa đổi cho đúng chuẩn (ví dụ: viết hoa đúng cách, sửa lỗi chính tả).
- "bold": true/false (chỉ định định dạng in đậm nếu cần, có thể bỏ qua nếu không cần).
- "italic": true/false (chỉ định định dạng in nghiêng, có thể bỏ qua).
- "alignment": "LEFT", "CENTER", "RIGHT", hoặc "JUSTIFY" (chỉ định căn lề nếu cần sửa, có thể bỏ qua).

Chỉ xuất ra kết quả JSON thuần túy (không kèm theo block code markdown như ```json).
Nếu không thể tự động sửa lỗi nào đó dựa trên dữ liệu, bỏ qua lỗi đó.
"""

AUTOFIX_PLAN_TEMPLATE = PromptTemplate(
    input_variables=["document_content", "errors_json"],
    template=AUTOFIX_PLAN_PROMPT
)

RAG_QA_PROMPT = """Bạn là trợ lý tra cứu quy định thể thức văn bản hành chính (Việt Nam).

NGỮ CẢNH (các đoạn trích từ Kho tri thức, có đánh số [1], [2], ...):
{context}

CÂU HỎI: {question}

QUY TẮC BẮT BUỘC:
1. Chỉ dùng thông tin có trong ngữ cảnh. Không suy diễn, không bịa điều khoản.
2. Trả lời ngắn gọn, rõ ràng. Nếu có nhiều ý, dùng gạch đầu dòng.
3. Nếu ngữ cảnh không đủ để trả lời chính xác, hãy viết đúng một câu: "Tôi không tìm thấy thông tin cụ thể về vấn đề này trong cơ sở dữ liệu luật hiện tại."
4. Khi trích ý từ ngữ cảnh, ghi kèm số tham chiếu dạng [1], [2] tương ứng với đoạn đã dùng.
"""

RAG_QA_TEMPLATE = PromptTemplate(
    input_variables=["context", "question"],
    template=RAG_QA_PROMPT
)

# ==================== PROMPT MỚI (v2.0) ====================

SUMMARIZE_PROMPT = """Bạn là trợ lý AI chuyên tóm tắt văn bản hành chính.
Hãy đọc văn bản sau và tóm tắt thành TỐI ĐA 3 ý chính ngắn gọn, dễ hiểu.

Văn bản cần tóm tắt:
{document_content}

Trả về kết quả dưới dạng JSON thuần túy (không kèm markdown block):
{{
    "summary": "Tóm tắt tổng quan trong 1-2 câu",
    "key_points": [
        "Ý chính 1",
        "Ý chính 2", 
        "Ý chính 3"
    ]
}}
"""

SUMMARIZE_TEMPLATE = PromptTemplate(
    input_variables=["document_content"],
    template=SUMMARIZE_PROMPT
)

STRUCTURE_SCORE_PROMPT = """Bạn là hệ thống AI chấm điểm cấu trúc văn bản hành chính theo quy chuẩn CV5512.
Hãy kiểm tra văn bản dưới đây có đầy đủ các thành phần cấu trúc bắt buộc hay không.

Các mục cần kiểm tra:
1. Quốc hiệu (CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM - Độc lập - Tự do - Hạnh phúc)
2. Tên cơ quan ban hành
3. Số hiệu văn bản
4. Địa danh và ngày tháng năm
5. Tên loại văn bản và trích yếu nội dung
6. Nội dung văn bản
7. Chữ ký và họ tên người có thẩm quyền
8. Nơi nhận

Văn bản cần chấm điểm:
{document_content}

Trả về kết quả dưới dạng JSON thuần túy:
{{
    "score": <số điểm từ 0 đến 100>,
    "present_sections": ["Danh sách các mục đã có"],
    "missing_sections": ["Danh sách các mục bị thiếu"],
    "details": "Nhận xét tổng quan ngắn gọn"
}}
"""

STRUCTURE_SCORE_TEMPLATE = PromptTemplate(
    input_variables=["document_content"],
    template=STRUCTURE_SCORE_PROMPT
)
