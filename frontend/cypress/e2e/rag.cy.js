/**
 * RAG E2E Tests — Module Tra cứu Quy định bằng AI (RAG Search)
 *
 * Selectors dựa theo SearchRules.jsx
 * - Route: /search-rules
 * - Input placeholder: "VD: Quốc hiệu viết hoa hay viết thường? Căn lề như thế nào?"
 * - Button: "Tìm kiếm"
 * - Kết quả: "Câu trả lời từ AI:", "Nguồn trích dẫn:"
 */

describe('Module Tra Cứu Quy Định RAG (SEARCH RULES)', () => {
  beforeEach(() => {
    cy.loginViaApi('giaovien', '123456');
  });

  it('RAG-01: Trang Tra Cứu Quy Định hiển thị đúng', () => {
    cy.visit('/search-rules');

    cy.contains('Tra cứu Quy định Thể thức bằng AI').should('be.visible');
    cy.get('input[placeholder*="Quốc hiệu"]').should('be.visible');
    cy.contains('Tìm kiếm').should('be.visible');
  });

  it('RAG-02: Tìm kiếm ngữ nghĩa → AI trả lời + nguồn trích dẫn', () => {
    cy.visit('/search-rules');

    // Nhập câu hỏi
    cy.get('input[placeholder*="Quốc hiệu"]').type('Thể thức trình bày văn bản');
    cy.contains('Tìm kiếm').click();

    // Chờ loading
    cy.contains('Đang tra cứu', { timeout: 5000 }).should('be.visible');

    // Kết quả hiển thị
    cy.contains('Câu trả lời từ AI:', { timeout: 30000 }).should('be.visible');
    cy.contains('Nguồn trích dẫn:', { timeout: 5000 }).should('be.visible');
  });

  it('RAG-03: Tìm kiếm với input rỗng → không gửi request', () => {
    cy.visit('/search-rules');

    // Không nhập gì, bấm tìm kiếm
    cy.contains('Tìm kiếm').click();

    // Không có loading, không có kết quả
    cy.contains('Đang tra cứu').should('not.exist');
    cy.contains('Câu trả lời từ AI:').should('not.exist');
  });
});
