/**
 * BGH E2E Tests — Module Ban Giám Hiệu Dashboard & Phê duyệt
 *
 * Selectors dựa theo Dashboard.jsx, PendingDocuments.jsx, AdminHistory.jsx
 * - Dashboard.jsx: role check `ADMIN`, route `/`
 * - PendingDocuments.jsx: role check `BGH`, route `/reviewer/pending`
 * - AdminHistory.jsx: route `/admin/history`
 * - Sidebar.jsx: role check `ADMIN` → menu QUẢN TRỊ, role `REVIEWER` → menu KIỂM DUYỆT
 */

describe('Module Ban Giám Hiệu (BGH)', () => {
  beforeEach(() => {
    // Đăng nhập tài khoản BGH bằng API
    cy.loginViaApi('bgh', '123456');
  });

  it('BGH-01: Dashboard BGH hiển thị thống kê tổng quan', () => {
    cy.visit('/');

    // Kì vọng tiêu đề Dashboard
    cy.contains('Trang Chủ / Dashboard').should('be.visible');

    cy.contains('Bảng điều khiển vận hành văn bản', { timeout: 10000 }).should('be.visible');
    cy.contains('Tổng văn bản đã nộp').should('be.visible');
    cy.contains('Chờ Tổ trưởng duyệt').should('be.visible');
    cy.contains('BGH đã phê duyệt').should('be.visible');
    cy.contains('Văn bản nộp gần đây').should('be.visible');
    cy.contains('Deadline quá hạn').should('be.visible');
  });

  it('BGH-02: Truy cập trang Văn Bản Chờ Duyệt', () => {
    cy.visit('/reviewer/pending');

    cy.contains('Văn Bản Chờ Duyệt').should('be.visible');

    // Kiểm tra bảng dữ liệu tồn tại
    cy.get('table').should('be.visible');

    // Kiểm tra nút Phê duyệt Hàng loạt có mặt cho BGH
    cy.contains('Phê duyệt Hàng loạt').should('be.visible');

    // Kiểm tra nút Gộp Báo Cáo
    cy.contains('Gộp Báo Cáo').should('be.visible');
  });

  it('BGH-03: Phê duyệt hàng loạt (chọn checkbox → duyệt)', () => {
    cy.visit('/reviewer/pending');

    // Nếu có văn bản, check checkbox đầu tiên
    cy.get('table tbody tr').then($rows => {
      if ($rows.length > 0 && !$rows.text().includes('Không có văn bản')) {
        cy.get('table tbody input[type="checkbox"]').first().check();
        cy.contains('Phê duyệt Hàng loạt').click();

        // Cypress tự xử lý window.confirm → mặc định chọn OK
        cy.on('window:confirm', () => true);
      }
    });
  });

  it('BGH-04: Truy cập Lịch Sử Toàn Hệ Thống', () => {
    cy.visit('/admin/history');

    // Kì vọng trang audit history tải thành công
    cy.get('table', { timeout: 10000 }).should('be.visible');
  });

  it('BGH-05: Truy cập Quản Lý Users', () => {
    cy.visit('/admin/users');

    // Kì vọng trang user management tải
    cy.get('table', { timeout: 10000 }).should('be.visible');
  });

  it('BGH-06: Sidebar BGH hiển thị đầy đủ menu', () => {
    cy.visit('/');

    // Menu chung cho tất cả
    cy.get('.sidebar-nav').should('contain', 'Trang Chủ');
    cy.get('.sidebar-nav').should('contain', 'Kiểm Tra Văn Bản');
    cy.get('.sidebar-nav').should('contain', 'Tra Cứu Quy Định');
    cy.get('.sidebar-nav').should('contain', 'Kho Biểu Mẫu');
    cy.get('.sidebar-nav').should('contain', 'Lịch Deadline');
    cy.get('.sidebar-nav').should('contain', 'Lịch Sử Của Tôi');

    // Menu KIỂM DUYỆT (ADMIN = REVIEWER trong Sidebar)
    cy.get('.sidebar-nav').should('contain', 'KIỂM DUYỆT');
    cy.get('.sidebar-nav').should('contain', 'Văn Bản Chờ Duyệt');
    cy.get('.sidebar-nav').should('contain', 'Lịch Sử Đã Duyệt');

    // Menu QUẢN TRỊ (ADMIN only)
    cy.get('.sidebar-nav').should('contain', 'QUẢN TRỊ');
    cy.get('.sidebar-nav').should('contain', 'Kho Tri Thức');
    cy.get('.sidebar-nav').should('contain', 'Lịch Sử Toàn Hệ Thống');
    cy.get('.sidebar-nav').should('contain', 'Quản Lý Users');
  });
});
