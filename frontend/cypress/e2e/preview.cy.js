/**
 * PREVIEW — Xem trước văn bản trên trang kết quả
 */
describe('Module Xem trước văn bản (PREVIEW)', () => {
  beforeEach(() => {
    cy.loginViaApi('giaovien', '123456');
  });

  it('PREVIEW-01: Upload docx → trang kết quả có bản xem trước (không báo lỗi API)', () => {
    cy.visit('/upload');
    cy.get('#fileInput').selectFile('cypress/fixtures/test_doc.docx', { force: true });
    cy.contains('Bắt đầu kiểm tra AI').click();
    cy.url({ timeout: 120000 }).should('include', '/result/');
    cy.contains('Bản xem trước', { timeout: 15000 }).should('be.visible');
    cy.contains('Không thể hiển thị bản xem trước').should('not.exist');
    cy.get('.docx-preview', { timeout: 15000 }).should('exist');
    cy.get('.docx-preview').should('not.contain', '[size=');
  });
});
