import os
import json
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate

from prompts import DOCUMENT_CHECK_TEMPLATE
from vector_store import search_hybrid_documents, search_similar_documents

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
# Model hop le (list qua GET generativelanguage.googleapis.com/v1beta/models)
DEFAULT_GEMINI_FALLBACKS = "gemini-2.0-flash-lite,gemini-2.5-flash-lite,gemini-flash-latest"


def _gemini_model_candidates() -> list[str]:
    primary = os.getenv("LLM_MODEL", DEFAULT_GEMINI_MODEL).strip()
    fallbacks = [
        m.strip()
        for m in os.getenv("LLM_MODEL_FALLBACKS", DEFAULT_GEMINI_FALLBACKS).split(",")
        if m.strip()
    ]
    seen: set[str] = set()
    ordered: list[str] = []
    for name in [primary, *fallbacks]:
        if name and name not in seen:
            seen.add(name)
            ordered.append(name)
    return ordered


def _should_try_next_model(exc: Exception) -> bool:
    """Het quota hoac model khong ton tai — thu model tiep theo."""
    msg = str(exc).upper()
    if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "QUOTA" in msg:
        return True
    if "404" in msg or "NOT_FOUND" in msg:
        return True
    return False


def get_llm(model_override: str | None = None):
    if LLM_PROVIDER.lower() == "openai":
        return ChatOpenAI(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            model_name=model_override or os.getenv("LLM_MODEL", "gpt-4o-mini"),
            temperature=0.0,
        )
    return ChatGoogleGenerativeAI(
        google_api_key=os.getenv("GEMINI_API_KEY"),
        model=model_override or os.getenv("LLM_MODEL", DEFAULT_GEMINI_MODEL),
        temperature=0.0,
    )


def invoke_llm_chain(prompt_template, inputs: dict, parser=None):
    """Gọi LLM; nếu Gemini hết quota (429) thì thử model dự phòng."""
    parser = parser or StrOutputParser()
    last_error: Exception | None = None

    if LLM_PROVIDER.lower() == "openai":
        chain = prompt_template | get_llm() | parser
        return chain.invoke(inputs)

    for model_name in _gemini_model_candidates():
        try:
            chain = prompt_template | get_llm(model_name) | parser
            result = chain.invoke(inputs)
            if model_name != _gemini_model_candidates()[0]:
                print(f"[LLM] Đã dùng model dự phòng: {model_name}")
            return result
        except Exception as exc:
            last_error = exc
            if _should_try_next_model(exc):
                print(f"[LLM] {model_name} không dùng được ({exc}), thử model khác...")
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("Không có model Gemini nào khả dụng")


def check_document_errors(document_content: str):
    docs = search_similar_documents(query="Quy định thể thức văn bản hành chính", k=5)
    context_text = "\n\n".join([doc.page_content for doc in docs])

    raw_response = invoke_llm_chain(
        DOCUMENT_CHECK_TEMPLATE,
        {
            "context": context_text,
            "document_content": document_content[:5000],
        },
    )

    try:
        import re
        cleaned_resp = raw_response.replace("```json", "").replace("```", "").strip()
        cleaned_resp = re.sub(r"[\x00-\x1F\x7F-\x9F]", "", cleaned_resp)
        errors = json.loads(cleaned_resp)
        return errors
    except Exception as e:
        print(f"Lỗi parse JSON: {str(e)}\nRaw Response: {raw_response}")
        return []


from prompts import AUTOFIX_PLAN_TEMPLATE


def generate_autofix_plan(document_content: str, errors: list):
    if not errors:
        return []

    errors_json = json.dumps(
        [
            {
                "error_type": e.error_type,
                "description": e.description,
                "suggestion": e.suggestion,
            }
            for e in errors
        ],
        ensure_ascii=False,
    )

    raw_response = invoke_llm_chain(
        AUTOFIX_PLAN_TEMPLATE,
        {
            "document_content": document_content[:8000],
            "errors_json": errors_json,
        },
    )

    try:
        import re
        cleaned_resp = raw_response.replace("```json", "").replace("```", "").strip()
        cleaned_resp = re.sub(r"[\x00-\x1F\x7F-\x9F]", "", cleaned_resp)
        plan = json.loads(cleaned_resp)
        return plan
    except Exception as e:
        print(f"Lỗi parse autofix JSON: {e}")
        return []


from prompts import RAG_QA_TEMPLATE


def answer_knowledge_query(query: str, access_levels: list = None):
    filter_dict = None
    if access_levels:
        filter_dict = {"access_level": {"$in": access_levels}}

    pairs = search_hybrid_documents(query=query, k=10, filter_dict=filter_dict)
    if not pairs:
        return {
            "answer": "Không tìm thấy dữ liệu liên quan trong Kho tri thức.",
            "sources": [],
            "chunks": [],
        }

    numbered_parts = []
    sources_order = []
    chunks_out = []
    for i, (doc, score) in enumerate(pairs, start=1):
        src = doc.metadata.get("source", "Không rõ")
        title = doc.metadata.get("title", "")
        excerpt = (doc.page_content or "")[:900]
        numbered_parts.append(f"[{i}] (Nguồn: {src}" + (f" — {title}" if title else "") + f"; điểm={score:.3f})\n{doc.page_content}")
        if src not in sources_order:
            sources_order.append(src)
        chunks_out.append(
            {
                "index": i,
                "source": src,
                "title": title,
                "score": round(float(score), 4),
                "excerpt": excerpt + ("…" if len(doc.page_content or "") > 900 else ""),
            }
        )

    context_text = "\n\n---\n\n".join(numbered_parts)

    answer = invoke_llm_chain(
        RAG_QA_TEMPLATE,
        {"context": context_text, "question": query},
    )

    return {"answer": answer, "sources": sources_order, "chunks": chunks_out}


def summarize_document(document_content: str) -> dict:
    """Trả về dict {summary, key_points} cho API/frontend."""
    template = """
    Hãy tóm tắt văn bản hành chính sau bằng tiếng Việt.
    Trả về JSON hợp lệ (không markdown) với cấu trúc:
    {{"summary": "2-4 câu tóm tắt", "key_points": ["điểm 1", "điểm 2"]}}

    Văn bản:
    {document_content}
    """
    prompt = PromptTemplate.from_template(template)
    raw = invoke_llm_chain(prompt, {"document_content": document_content[:8000]})
    try:
        import re
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        cleaned = re.sub(r"[\x00-\x1F\x7F-\x9F]", "", cleaned)
        data = json.loads(cleaned)
        if isinstance(data, dict) and data.get("summary"):
            return {
                "summary": str(data["summary"]),
                "key_points": data.get("key_points") or [],
            }
    except Exception:
        pass
    plain = (raw or "").strip()
    if plain:
        return {"summary": plain, "key_points": []}
    return {"summary": "Không tạo được tóm tắt.", "key_points": []}


def score_document_structure(document_content: str, errors_count: int) -> int:
    base_score = 100
    penalty = errors_count * 5
    score = base_score - penalty
    return max(0, score)
