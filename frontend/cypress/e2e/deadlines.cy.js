/**
 * DEADLINES E2E Tests — Module Quản lý Thời hạn
 *
 * Selectors dựa theo Deadlines.jsx
 * - Route: /deadlines
 * - Form controls: input[type="text"] (title), textarea (description), 
 *   input[type="datetime-local"], input[type="text"] (department)
 * - Buttons: "+ Tạo Deadline mới", "Lưu Deadline", "Xóa"
 * - Role check: BGH / TO_TRUONG → isManager = true → có nút tạo/xóa
 */

describe('Module Quản lý Deadline (DEADLINES)', () => {

  it('DL-01: Giáo viên xem danh sách Deadlines', () => {
    cy.loginViaApi('giaovien', '123456');
    cy.visit('/deadlines');

    // Tiêu đề trang
    cy.contains('Quản lý Deadline').should('be.visible');

    // Giáo viên KHÔNG thấy nút tạo mới
    cy.contains('+ Tạo Deadline mới').should('not.exist');

    // Bảng danh sách hiển thị
    cy.get('table').should('be.visible');
  });

  it('DL-02: BGH tạo Deadline mới', () => {
    cy.loginViaApi('bgh', '123456');
    cy.visit('/deadlines');

    // BGH thấy nút tạo mới
    cy.contains('+ Tạo Deadline mới').should('be.visible').click();

    // Form xuất hiện
    cy.contains('Tiêu đề').should('be.visible');

    // Nhập thông tin
    cy.get('input[type="text"]').first().clear().type('Nộp giáo án HK2 - Tổ Toán');
    cy.get('textarea').type('Yêu cầu tất cả GV tổ Toán nộp giáo án');
    cy.get('input[type="datetime-local"]').type('2026-12-31T23:59');
    // Ô "Giao cho Tổ CM" — input type=text thứ 2 trong form
    cy.get('input[placeholder*="Toán, Văn, Anh"]').type('Toán');

    // Submit
    cy.contains('Lưu Deadline').click();

    // Alert thông báo thành công
    cy.on('window:alert', (text) => {
      expect(text).to.contain('Tạo deadline thành công');
    });
  });

  it('DL-03: BGH xóa Deadline', () => {
    cy.loginViaApi('bgh', '123456');
    cy.visit('/deadlines');

    // Nếu có deadline, bấm nút Xóa
    cy.get('table tbody tr').then($rows => {
      if ($rows.length > 0 && !$rows.text().includes('Không có deadline nào')) {
        // Bấm nút Xóa đầu tiên
        cy.get('table tbody button').contains('Xóa').first().click();

        // Confirm dialog
        cy.on('window:confirm', () => true);
      }
    });
  });
});
