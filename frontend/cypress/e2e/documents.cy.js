/**
 * DOCUMENTS E2E Tests — Module Kiểm tra Thể thức AI & Xuất Báo cáo
 *
 * Selectors dựa theo UploadDocument.jsx, ResultScreen.jsx
 * - Route upload: /upload
 * - File input: #fileInput (accept=".pdf,.docx")
 * - Button upload: "Bắt đầu kiểm tra AI"
 * - Error message: .error-message
 * - Route result: /result/:id
 * - Button export: "Xuất Báo Cáo"
 * - Button summarize: "🤖 AI Tóm tắt"
 * - Error list: .errors-list, .error-card
 */

describe('Module Kiểm tra Văn bản AI (DOCUMENTS)', () => {
  beforeEach(() => {
    // Đăng nhập bằng API để tiết kiệm thời gian
    cy.loginViaApi('giaovien', '123456');
  });

  it('AI-01: Upload file .docx hợp lệ → AI quét lỗi và hiển thị kết quả', () => {
    cy.visit('/upload');

    // Kiểm tra trang upload hiển thị
    cy.contains('Kiểm Tra Rà Soát Văn Bản').should('be.visible');

    // Upload file docx (fixture)
    cy.get('#fileInput').selectFile('cypress/fixtures/test_doc.docx', { force: true });

    // File preview xuất hiện
    cy.get('.file-preview').should('be.visible');
    cy.get('.file-name').should('contain', 'test_doc.docx');

    // Bấm nút kiểm tra AI
    cy.contains('Bắt đầu kiểm tra AI').click();

    // Chờ loading hoàn tất (thanh tiến trình)
    cy.contains('Đang Tải Lên', { timeout: 5000 }).should('be.visible');

    // Đợi chuyển hướng sang trang kết quả
    cy.url({ timeout: 60000 }).should('include', '/result/');

    // Trang kết quả hiển thị danh sách lỗi
    cy.contains('Kết Quả Rà Soát (AI)', { timeout: 10000 }).should('be.visible');
  });

  it('AI-02: Upload sai định dạng → hiển thị lỗi ngay trên giao diện', () => {
    cy.visit('/upload');

    // Cố upload file jpg — frontend validate trước khi gửi API
    cy.get('#fileInput').selectFile('cypress/fixtures/test_image.jpg', { force: true });

    // Kì vọng: hiện thông báo lỗi trên giao diện
    cy.get('.error-message').should('be.visible')
      .and('contain', 'Vui lòng chỉ tải lên file PDF hoặc DOCX');

    // File preview KHÔNG xuất hiện
    cy.get('.file-preview').should('not.exist');
  });

  it('AI-03: Nút AI Tóm tắt trong trang ResultScreen', () => {
    // Truy cập trang kết quả (giả sử history_id=1 đã tồn tại)
    cy.visit('/result/1');

    // Kiểm tra nút AI Tóm tắt tồn tại
    cy.contains('🤖 AI Tóm tắt').should('be.visible').click();

    // Modal tóm tắt xuất hiện
    cy.contains('🤖 AI Tóm Tắt Văn Bản', { timeout: 15000 }).should('be.visible');
  });

  it('AI-04: Nút Xuất Báo Cáo trong trang ResultScreen', () => {
    cy.visit('/result/1');

    // Kiểm tra nút xuất báo cáo tồn tại
    cy.contains('Xuất Báo Cáo').should('be.visible').click();

    // Không nên có alert lỗi. Nếu API thất bại sẽ có alert "Không thể tải báo cáo"
    // Không assert download vì Cypress không track file download trực tiếp.
    // Chỉ verify nút hoạt động mà không crash.
  });
});
