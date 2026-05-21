import os
import glob
import fitz  # PyMuPDF
import docx
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

# Sử dụng model đa ngôn ngữ của SentenceTransformers (Hỗ trợ tiếng Việt rất tốt, chạy local miễn phí)
EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
embeddings = None

# Thư mục lưu trữ Vector DB
CHROMA_DB_DIR = "./chroma_db"

def extract_text_from_pdf(file_path):
    text = ""
    try:
        doc = fitz.open(file_path)
        for page in doc:
            text += page.get_text() + "\n"
    except Exception as e:
        print(f"Lỗi đọc PDF {file_path}: {e}")
    return text

def extract_text_from_docx(file_path):
    text = ""
    try:
        doc = docx.Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        print(f"Lỗi đọc DOCX {file_path}: {e}")
    return text

def get_vectorstore():
    global embeddings
    if embeddings is None:
        embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
        
    vectorstore = Chroma(
        collection_name="qlda_rules",
        embedding_function=embeddings,
        persist_directory=CHROMA_DB_DIR
    )
    return vectorstore

def ingest_ground_truth_data(folder_path):
    print(f"Đang tiến hành đọc tài liệu mẫu từ: {folder_path} ...")
    documents = []
    metadatas = []
    
    # Quét toàn bộ file pdf, docx trong thư mục
    for file_path in glob.glob(os.path.join(folder_path, "*.*")):
        ext = file_path.split('.')[-1].lower()
        file_name = os.path.basename(file_path)
        
        text = ""
        if ext == "pdf":
            text = extract_text_from_pdf(file_path)
        elif ext in ["docx", "doc"]:
            text = extract_text_from_docx(file_path)
        else:
            continue
            
        if not text.strip():
            continue
            
        print(f"✅ Đã bóc tách thành công file: {file_name} ({len(text)} ký tự)")
        
        # Bước Chunking: Phân mảnh văn bản ra thành từng đoạn nhỏ 1000 ký tự
        # overlap 200 ký tự để không bị đứt đoạn ngữ nghĩa
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ".", " ", ""]
        )
        chunks = text_splitter.split_text(text)
        
        for i, chunk in enumerate(chunks):
            documents.append(chunk)
            metadatas.append({
                "source": file_name,
                "chunk_index": i,
                "access_level": "GIAO_VIEN"
            })

    if not documents:
        print("Không tìm thấy dữ liệu hợp lệ nào để nhúng.")
        return

    print(f"🚀 Tiến hành nhúng (Embedding) tổng cộng {len(documents)} chunks vào ChromaDB...")
    
    vectorstore = get_vectorstore()
    vectorstore.add_texts(texts=documents, metadatas=metadatas)
    
    print(f"🎉 HOÀN TẤT: Toàn bộ tri thức đã được nạp thành công vào {CHROMA_DB_DIR}!")

if __name__ == "__main__":
    # Chỉ đường dẫn ra thư mục ground_truth_data của User
    ground_truth_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ground_truth_data"))
    ingest_ground_truth_data(ground_truth_folder)
