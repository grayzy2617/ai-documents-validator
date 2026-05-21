/**
 * NAVIGATION E2E Tests — Kiểm tra điều hướng toàn bộ Sidebar
 *
 * Test mọi nút nhấn trên Sidebar, đảm bảo navigate tới đúng trang
 * và mỗi trang tải nội dung thành công.
 */

describe('Module Điều hướng Sidebar (NAVIGATION)', () => {
  
  context('Giáo viên — Menu cơ bản', () => {
    beforeEach(() => {
      cy.loginViaApi('giaovien', '123456');
    });

    it('NAV-01: Bấm "Trang Chủ" → mở Dashboard', () => {
      cy.visit('/upload'); // Bắt đầu ở trang khác
      cy.get('.sidebar-nav').contains('Trang Chủ').click();
      cy.url().should('eq', Cypress.config().baseUrl + '/');
      cy.contains('Trang Chủ / Dashboard').should('be.visible');
    });

    it('NAV-02: Bấm "Kiểm Tra Văn Bản" → mở trang Upload', () => {
      cy.visit('/');
      cy.get('.sidebar-nav').contains('Kiểm Tra Văn Bản').click();
      cy.url().should('include', '/upload');
      cy.contains('Kiểm Tra Rà Soát Văn Bản').should('be.visible');
    });

    it('NAV-03: Bấm "Tra Cứu Quy Định" → mở trang SearchRules', () => {
      cy.visit('/');
      cy.get('.sidebar-nav').contains('Tra Cứu Quy Định').click();
      cy.url().should('include', '/search-rules');
      cy.contains('Tra cứu Quy định Thể thức bằng AI').should('be.visible');
    });

    it('NAV-04: Bấm "Kho Biểu Mẫu" → mở trang Templates', () => {
      cy.visit('/');
      cy.get('.sidebar-nav').contains('Kho Biểu Mẫu').click();
      cy.url().should('include', '/templates');
    });

    it('NAV-05: Bấm "Lịch Deadline" → mở trang Deadlines', () => {
      cy.visit('/');
      cy.get('.sidebar-nav').contains('Lịch Deadline').click();
      cy.url().should('include', '/deadlines');
      cy.contains('Quản lý Deadline').should('be.visible');
    });

    it('NAV-06: Bấm "Lịch Sử Của Tôi" → mở trang History', () => {
      cy.visit('/');
      cy.get('.sidebar-nav').contains('Lịch Sử Của Tôi').click();
      cy.url().should('include', '/history');
    });

    it('NAV-07: Dashboard Quick Actions — Bấm "Tải văn bản lên"', () => {
      cy.visit('/');
      cy.contains('Tải văn bản lên').click();
      cy.url().should('include', '/upload');
    });

    it('NAV-08: Dashboard Quick Actions — Bấm "Tra Cứu AI"', () => {
      cy.visit('/');
      cy.contains('Tra Cứu AI').click();
      cy.url().should('include', '/search-rules');
    });

    it('NAV-09: Dashboard Quick Actions — Bấm "Xem lịch sử"', () => {
      cy.visit('/');
      cy.contains('Xem lịch sử').click();
      cy.url().should('include', '/history');
    });
  });

  context('BGH — Menu mở rộng', () => {
    beforeEach(() => {
      cy.loginViaApi('bgh', '123456');
    });

    it('NAV-10: Bấm "Văn Bản Chờ Duyệt" → mở trang PendingDocuments', () => {
      cy.visit('/');
      cy.get('.sidebar-nav').contains('Văn Bản Chờ Duyệt').click();
      cy.url().should('include', '/reviewer/pending');
      cy.contains('Văn Bản Chờ Duyệt').should('be.visible');
    });

    it('NAV-11: Bấm "Lịch Sử Đã Duyệt" → mở trang ReviewedHistory', () => {
      cy.visit('/');
      cy.get('.sidebar-nav').contains('Lịch Sử Đã Duyệt').click();
      cy.url().should('include', '/reviewer/history');
    });

    it('NAV-12: Bấm "Kho Tri Thức" → mở trang AdminRules', () => {
      cy.visit('/');
      cy.get('.sidebar-nav').contains('Kho Tri Thức').click();
      cy.url().should('include', '/admin/rules');
    });

    it('NAV-13: Bấm "Lịch Sử Toàn Hệ Thống" → mở trang AdminHistory', () => {
      cy.visit('/');
      cy.get('.sidebar-nav').contains('Lịch Sử Toàn Hệ Thống').click();
      cy.url().should('include', '/admin/history');
    });

    it('NAV-14: Bấm "Quản Lý Users" → mở trang AdminUsers', () => {
      cy.visit('/');
      cy.get('.sidebar-nav').contains('Quản Lý Users').click();
      cy.url().should('include', '/admin/users');
    });
  });
});
