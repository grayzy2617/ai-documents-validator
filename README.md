# AI Documents Validator 📄🤖

> **Hệ thống tự động kiểm tra và chuẩn hóa thể thức văn bản hành chính ứng dụng công nghệ RAG (Retrieval-Augmented Generation) và Trí tuệ nhân tạo (Generative AI).**

Dự án được xây dựng nhằm giải quyết bài toán kiểm tra, rà soát lỗi thể thức văn bản hành chính (theo quy chuẩn **Nghị định 30/2020/NĐ-CP** và nội quy đơn vị) tại các trường THPT và cơ quan hành chính sự nghiệp. Hệ thống tự động phát hiện các lỗi định dạng, dẫn chiếu trực tiếp đến các điều khoản luật quy chuẩn và cung cấp tính năng **Auto-Fix (Tự động sửa lỗi 1-click)** giúp tiết kiệm 75% thời gian xử lý thủ công.

---

## 🌟 Các Tính Năng Cốt Lõi (Phân Quyền Chi Tiết)

Hệ thống được thiết kế hoàn chỉnh với 3 nhóm vai trò (Roles) chính:

### 1. Vai trò Giáo viên / Văn thư (User)
* **Tải lên & Quản lý văn bản:** Hỗ trợ kéo thả các định dạng tài liệu phổ biến như `.docx`, `.pdf`.
* **Kiểm tra thể thức bằng AI:** Hệ thống tự động phát hiện các lỗi về font chữ, cỡ chữ, căn lề, dãn dòng, thiếu quốc hiệu, tiêu ngữ...
* **Tra cứu luật liên quan (RAG):** AI tự động trích dẫn chính xác điều khoản quy chuẩn pháp luật từ cơ sở dữ liệu tri thức đối với từng lỗi được phát hiện.
* **Auto-Fix (Chuẩn hóa tự động 1-click):** Tự động căn chỉnh lại các lỗi cơ bản ngay trên file Word (.docx) của người dùng mà không ảnh hưởng tới nội dung văn bản gốc.
* **Chỉnh sửa thủ công (Manual Fix):** Xem trước vị trí lỗi được highlight trực quan và sửa nhanh lỗi ngay trên giao diện web.
* **Xuất báo cáo:** Tải về file Word đã sửa đổi hoặc xuất báo cáo chi tiết các lỗi phát hiện dưới dạng PDF.

### 2. Vai trò Ban Giám Hiệu / Kiểm Duyệt Viên (Reviewer)
* **Quản lý danh sách duyệt:** Xem toàn bộ các văn bản của giáo viên đang chờ duyệt ban hành.
* **Đánh giá kết quả của AI:** Xem các lỗi AI phát hiện để xác nhận lỗi đúng/sai hoặc chỉnh sửa/bổ sung lỗi thủ công dựa trên nghiệp vụ thực tế.
* **Phê duyệt & Phản hồi:** Quyết định phê duyệt văn bản đạt chuẩn ban hành hoặc từ chối kèm theo nhận xét hướng dẫn giáo viên sửa lại.

### 3. Vai trò Quản trị viên (Admin)
* **Quản trị hệ thống & Tài khoản:** Quản lý tài khoản (CRUD), phân quyền truy cập cho cán bộ nhà trường.
* **Quản lý Kho tri thức (Vector DB):** Tải lên các văn bản luật mới, cập nhật hoặc vô hiệu hóa các quy định cũ để cập nhật chỉ mục tìm kiếm cho AI.
* **Báo cáo thống kê:** Dashboard trực quan hóa số lượng văn bản đã quét, tần suất sử dụng hệ thống và **thống kê các lỗi thể thức phổ biến nhất** trong trường để hỗ trợ công tác tập huấn nghiệp vụ.
* **Nhật ký hệ thống (Audit log):** Giám sát hoạt động của người dùng và lưu vết bảo mật hệ thống.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

### Backend
* **Ngôn ngữ chính:** `Python`
* **Web Framework:** `FastAPI` (Xây dựng các RESTful API hiệu năng cao)
* **Cơ sở dữ liệu:** `SQLite` với ORM `SQLAlchemy` (Lưu thông tin tài khoản, lịch sử kiểm tra, chi tiết lỗi)

### Trí tuệ nhân tạo (AI) & RAG Pipeline
* **Framework:** `LangChain`
* **Mô hình nhúng (Embedding Model):** `intfloat/multilingual-e5-base` (Chạy local thông qua thư viện HuggingFace Embeddings, xử lý tiếng Việt tối ưu)
* **Cơ sở dữ liệu Vector:** `ChromaDB` (Lưu trữ và truy xuất tri thức luật dạng Vector)
* **Mô hình ngôn ngữ lớn (LLM):** `Google Gemini 2.5 Flash` / `Gemini 2.0 Flash Lite` (Đảm bảo tốc độ phản hồi cực nhanh <3 giây và chi phí tối ưu) kèm cơ chế tự động chuyển đổi mô hình dự phòng (Fallback) khi hết quota.
* **Thư viện xử lý file:** `PyMuPDF (fitz)` (xử lý PDF) và `python-docx` (xử lý định dạng Word).

### Frontend
* **Framework:** `React.js` (Khởi tạo bằng `Vite`)
* **Styling:** Vanilla CSS (Thiết kế giao diện hiện đại, trực quan, hỗ trợ so sánh lỗi side-by-side)

---

## ⚙️ Hướng Dẫn Cài Đặt Và Khởi Chạy

Dự án yêu cầu cài đặt sẵn: **Python (3.9+)** và **Node.js (16+)**.

### Bước 1: Thiết lập Backend

1. Di chuyển vào thư mục backend:
   ```bash
   cd backend
   ```
2. Tạo môi trường ảo và kích hoạt:
   * **Trên Windows (Powershell):**
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   * **Trên macOS/Linux:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```
3. Cài đặt các thư viện cần thiết:
   ```bash
   pip install -r requirements.txt
   ```
4. Cấu hình các biến môi trường:
   Tạo file `.env` tại thư mục `/backend` (hoặc sử dụng file `.env` có sẵn) và cấu hình các khóa cần thiết:
   ```env
   DATABASE_URL=sqlite:///./qlda_rag.db
   SECRET_KEY=supersecretkey_for_jwt_auth_qlda
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440

   LLM_PROVIDER=gemini
   LLM_MODEL=gemini-2.5-flash
   LLM_MODEL_FALLBACKS=gemini-2.0-flash,gemini-2.0-flash-lite,gemini-2.5-flash-lite
   GEMINI_API_KEY=AIzaSy... (Khóa API Gemini của bạn)
   ```

5. Khởi tạo dữ liệu luật (Reindex Vector DB):
   Chạy script để bóc tách các file văn bản quy chuẩn hành chính nằm trong thư mục `ground_truth_data` nạp vào ChromaDB:
   ```bash
   python scripts/reindex_knowledge_chroma.py
   ```

6. Khởi chạy server FastAPI:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *API Swagger Docs sẽ khả dụng tại địa chỉ: `http://localhost:8000/docs`*

---

### Bước 2: Thiết lập Frontend

1. Mở một terminal mới và di chuyển vào thư mục frontend:
   ```bash
   cd frontend
   ```
2. Cài đặt các gói phụ thuộc (Dependencies):
   ```bash
   npm install
   ```
3. Khởi chạy ứng dụng ở chế độ phát triển (Development mode):
   ```bash
   npm run dev
   ```
   *Giao diện ứng dụng sẽ chạy tại địa chỉ: `http://localhost:5173`*

---

## 📂 Cấu Trúc Dự Án Tiêu Biểu

```text
├── backend/
│   ├── chroma_db__/             # Thư mục chứa CSDL Vector ChromaDB (lưu index luật)
│   ├── ground_truth_data/       # Các file nghị định, thông tư quy chuẩn đầu vào (.pdf, .docx)
│   ├── routers/                 # Định nghĩa các router FastAPI (auth, documents, configs...)
│   ├── scripts/                 # Các script bổ trợ hệ thống (reindex dữ liệu luật...)
│   ├── main.py                  # Điểm khởi chạy của backend FastAPI
│   ├── models.py                # Định nghĩa các bảng CSDL SQLite (SQLAlchemy models)
│   ├── document_processor.py    # Code bóc tách nội dung PDF/Word và OCR
│   ├── docx_editor.py           # Code xử lý định dạng trực tiếp trên file Word (Auto-Fix)
│   ├── vector_store.py          # Quản lý ChromaDB, Hybrid Search và phân mảnh luật
│   └── llm_service.py           # Quản lý gọi API Gemini/OpenAI, fallback logic
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Các component React tái sử dụng
│   │   ├── pages/               # Các trang giao diện (Dashboard, Login, ResultScreen...)
│   │   ├── services/            # Code gọi API backend
│   │   ├── App.jsx              # Routing và cấu trúc giao diện chính
│   │   └── main.jsx             # Điểm khởi chạy của ứng dụng React
│   └── package.json
```
