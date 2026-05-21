import gc
import os
import re
import shutil
import time

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document

_BACKEND_DIR = os.path.dirname(__file__)
# Thư mục Chroma cũ (MiniLM 384) — không dùng nữa khi EMBEDDING_MODEL đổi; có thể xóa tay khi server tắt
LEGACY_CHROMA_DB_DIR = os.path.join(_BACKEND_DIR, "chroma_db")

# Đa ngôn ngữ, tốt hơn tiếng Việt so với all-MiniLM-L6-v2 (RAG-Std B2.1)
DEFAULT_EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL",
    "intfloat/multilingual-e5-base",
)

_embeddings_model = None
_chroma_instance = None


def get_chroma_db_dir(model_name: str | None = None) -> str:
    """
    Mỗi embedding model một thư mục riêng — tránh lỗi 384 vs 768 khi đổi model
    và không phải xóa chroma.sqlite3 khi server đang chạy (WinError 32).
    """
    model = (model_name or DEFAULT_EMBEDDING_MODEL).strip()
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "_", model.replace("/", "__"))[:100]
    return os.path.join(_BACKEND_DIR, f"chroma_db__{slug}")


# Tương thích script cũ
CHROMA_DB_DIR = get_chroma_db_dir()


def _is_embedding_dimension_mismatch(exc: BaseException) -> bool:
    m = str(exc).lower()
    if "dimension" in m and "embedding" in m:
        return True
    if "expecting embedding" in m:
        return True
    return False


def reset_vector_store_cache(close_active: Chroma | None = None) -> None:
    """Đóng handle Chroma trong process hiện tại (trước khi xóa thư mục / đổi path)."""
    global _embeddings_model, _chroma_instance
    target = close_active if close_active is not None else _chroma_instance
    if target is not None:
        try:
            del target
        except Exception:
            pass
    _embeddings_model = None
    _chroma_instance = None
    gc.collect()


def wipe_chroma_dir(path: str | None = None, *, close_active: Chroma | None = None) -> None:
    """
    Xóa thư mục vector — chỉ dùng khi chạy script reindex (server nên TẮT).
    Có retry cho WinError 32 trên Windows.
    """
    target = path or get_chroma_db_dir()
    reset_vector_store_cache(close_active=close_active)
    last_err: Exception | None = None
    for attempt in range(6):
        try:
            if os.path.isdir(target):
                shutil.rmtree(target)
            os.makedirs(target, exist_ok=True)
            print(f"[vector_store] Da xoa {target}")
            return
        except PermissionError as e:
            last_err = e
            time.sleep(0.35 * (attempt + 1))
            gc.collect()
    raise RuntimeError(
        f"Khong xoa duoc {target}: file dang bi process khac giu (WinError 32). "
        "Hay Ctrl+C tat uvicorn, roi chay: py -3 scripts/reindex_knowledge_chroma.py"
    ) from last_err


def _recover_from_embedding_mismatch(vector_store: Chroma | None) -> Chroma:
    """
    Khi gặp collection cũ sai chiều: không xóa file lúc server đang chạy —
    chỉ reset cache và mở lại thư mục theo EMBEDDING_MODEL hiện tại.
    """
    reset_vector_store_cache(close_active=vector_store)
    print(
        "[vector_store] Reset cache Chroma (embedding mismatch). Thu muc: "
        + get_chroma_db_dir()
        + " — neu tra cuu trong, chay scripts/reindex_knowledge_chroma.py"
    )
    return get_vector_store()


def get_embedding_model_name() -> str:
    return DEFAULT_EMBEDDING_MODEL


def _new_embeddings():
    return HuggingFaceEmbeddings(model_name=DEFAULT_EMBEDDING_MODEL)


def get_vector_store():
    global _embeddings_model, _chroma_instance
    persist_dir = get_chroma_db_dir()
    os.makedirs(persist_dir, exist_ok=True)
    if _embeddings_model is None:
        _embeddings_model = _new_embeddings()
    if _chroma_instance is None:
        _chroma_instance = Chroma(
            persist_directory=persist_dir,
            embedding_function=_embeddings_model,
        )
    return _chroma_instance


def _similarity_search_with_score_resilient(vector_store: Chroma, query: str, k: int):
    try:
        return vector_store.similarity_search_with_score(query, k=k)
    except Exception as e:
        if _is_embedding_dimension_mismatch(e):
            vector_store = _recover_from_embedding_mismatch(vector_store)
            return vector_store.similarity_search_with_score(query, k=k)
        raise


def _add_texts_resilient(vector_store: Chroma, texts: list, metadatas: list):
    try:
        vector_store.add_texts(texts=texts, metadatas=metadatas)
    except Exception as e:
        if _is_embedding_dimension_mismatch(e):
            vector_store = _recover_from_embedding_mismatch(vector_store)
            vector_store.add_texts(texts=texts, metadatas=metadatas)
            return
        raise


def chunk_text_law(text: str, max_chunk: int = 1200, min_chunk: int = 350) -> list[str]:
    """
    Chia chunk ưu tiên đoạn lớn theo luật (Điều / Chương / PHẦN / Mục).
    RAG-Std B2.2
    """
    text = (text or "").strip()
    if not text:
        return []

    law_heading = re.compile(
        r"(^\s*(Điều\s+\d+|CHƯƠNG\s+[IVXLCDM\d]+|Chương\s+[IVXLCDM\d]+|PHẦN\s+[IVXLCDM\d]+|Mục\s+\d+)\s*[\.:]?)",
        re.MULTILINE | re.IGNORECASE,
    )

    def split_large_block(block: str) -> list[str]:
        block = block.strip()
        if len(block) <= max_chunk:
            return [block] if block else []
        out: list[str] = []
        last = 0
        for m in law_heading.finditer(block):
            if m.start() > last:
                piece = block[last : m.start()].strip()
                if piece:
                    out.extend(split_large_block(piece) if len(piece) > max_chunk else [piece])
            last = m.start()
        tail = block[last:].strip()
        if tail:
            if len(tail) > max_chunk:
                for i in range(0, len(tail), max_chunk - 80):
                    out.append(tail[i : i + max_chunk])
            else:
                out.append(tail)
        return out if out else [block[:max_chunk]]

    blocks = [b.strip() for b in re.split(r"\n{2,}", text) if b.strip()]
    raw_chunks: list[str] = []
    for b in blocks:
        if len(b) <= max_chunk:
            raw_chunks.append(b)
        else:
            raw_chunks.extend(split_large_block(b))

    merged: list[str] = []
    for c in raw_chunks:
        c = c.strip()
        if not c:
            continue
        if merged and len(merged[-1]) < min_chunk and len(merged[-1]) + len(c) + 2 <= max_chunk:
            merged[-1] = (merged[-1] + "\n\n" + c).strip()
        else:
            merged.append(c)
    return merged if merged else [text[:max_chunk]]


def add_document_to_db(text: str, metadata: dict):
    """Thêm văn bản đã là plain text vào Chroma (chunk theo luật)."""
    vector_store = get_vector_store()
    chunks = chunk_text_law(text)
    metadatas = [dict(metadata) for _ in chunks]
    _add_texts_resilient(vector_store, chunks, metadatas)


def _keyword_overlap_score(query: str, doc_text: str) -> float:
    qtokens = re.findall(
        r"[\wàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+",
        (query or "").lower(),
        flags=re.IGNORECASE,
    )
    text_l = (doc_text or "").lower()
    s = 0.0
    for t in qtokens:
        if len(t) < 3:
            continue
        if t in text_l:
            s += 1.0
    return s / max(1, len([x for x in qtokens if len(x) >= 3]))


def _allowed_access_levels(filter_dict: dict | None) -> set[str] | None:
    """Chuyển filter_dict của RAG sang tập access_level; None = không lọc."""
    if not filter_dict:
        return None
    raw = filter_dict.get("access_level")
    if isinstance(raw, dict) and "$in" in raw and isinstance(raw["$in"], (list, tuple)):
        return {str(x) for x in raw["$in"]}
    if isinstance(raw, str):
        return {raw}
    return None


def search_hybrid_documents(query: str, k: int = 8, filter_dict: dict | None = None) -> list[tuple[Document, float]]:
    """
    Vector + điểm từ khóa (hybrid đơn giản). RAG-Std B2.3
    Trả về (Document, combined_score) với combined_score càng cao càng tốt.

    Lọc access_level thực hiện trong Python — không truyền filter xuống Chroma
    (tránh lỗi tương thích / cú pháp where khiến 500 trên một số bản langchain-chroma).
    """
    vector_store = get_vector_store()
    allowed = _allowed_access_levels(filter_dict)
    # Lấy dư vector rồi lọc quyền để vẫn đủ kết quả sau khi loại metadata
    fetch_k = min(max(k * 5, 15), 40)
    fetch_n = min(120, fetch_k * (4 if allowed else 1))

    pairs = _similarity_search_with_score_resilient(vector_store, query, fetch_n)

    if allowed is not None:
        pairs = [(d, dist) for d, dist in pairs if (d.metadata or {}).get("access_level") in allowed]

    scored: list[tuple[Document, float]] = []
    for doc, dist in pairs:
        dist_f = float(dist) if dist is not None else 1.0
        vec_sim = 1.0 / (1.0 + dist_f)
        kw = _keyword_overlap_score(query, doc.page_content)
        combined = 0.65 * vec_sim + 0.35 * kw
        scored.append((doc, combined))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:k]


def search_similar_documents(query: str, k: int = 5, filter: dict | None = None):
    """Tương thích cũ: chỉ trả Document (hybrid)."""
    return [d for d, _ in search_hybrid_documents(query, k=k, filter_dict=filter)]


def delete_document_from_db(source_filename: str):
    try:
        vector_store = get_vector_store()
        collection = vector_store._collection
        collection.delete(where={"source": source_filename})
    except Exception as e:
        raise RuntimeError(f"Loi khi xoa khoi Vector DB: {e}") from e
