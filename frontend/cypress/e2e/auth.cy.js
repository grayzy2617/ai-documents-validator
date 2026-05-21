/**
 * AUTH E2E Tests — Module Xác thực & Phân quyền
 * 
 * Selectors dựa theo Login.jsx, MainLayout.jsx, Sidebar.jsx
 * - Input placeholders: "Nhập username...", "Nhập mật khẩu..."
 * - Button text: "Đăng Nhập" (viết hoa)
 * - Error class: .login-error
 * - Sidebar role check: BGH / TO_TRUONG (đã fix từ ADMIN/REVIEWER cũ)
 * - Routes: /login, / (Dashboard)
 */

describe('Module Xác thực & Phân quyền (AUTH)', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('AUTH-01: Đăng nhập hợp lệ → chuyển hướng về Dashboard', () => {
    cy.visit('/login');

    // Kiểm tra form đăng nhập hiển thị
    cy.get('.login-title').should('contain', 'Đăng Nhập Hệ Thống RAG');

    // Nhập thông tin hợp lệ (giáo viên)
    cy.get('input[placeholder="Nhập username..."]').type('giaovien');
    cy.get('input[placeholder="Nhập mật khẩu..."]').type('123456');
    cy.get('button').contains('Đăng Nhập').click();

    // Kì vọng: chuyển về Dashboard (route /)
    cy.url().should('eq', Cypress.config().baseUrl + '/');

    // Kiểm tra layout hiển thị đúng
    cy.contains('Trang Chủ / Dashboard').should('be.visible');
    cy.contains('Chào,').should('be.visible');
  });

  it('AUTH-01b: Đăng nhập BGH → Sidebar có mục Quản trị', () => {
    cy.visit('/login');
    cy.get('input[placeholder="Nhập username..."]').type('bgh');
    cy.get('input[placeholder="Nhập mật khẩu..."]').type('123456');
    cy.get('button').contains('Đăng Nhập').click();

    cy.url().should('eq', Cypress.config().baseUrl + '/');

    // BGH (role=ADMIN trong Sidebar) → hiển thị menu Quản Trị
    cy.get('.sidebar-nav').should('contain', 'QUẢN TRỊ');
    cy.get('.sidebar-nav').should('contain', 'Kho Tri Thức');
    cy.get('.sidebar-nav').should('contain', 'Quản Lý Users');
  });

  it('AUTH-02: Sai thông tin đăng nhập → hiển thị lỗi', () => {
    cy.visit('/login');

    cy.get('input[placeholder="Nhập username..."]').type('wrong_user');
    cy.get('input[placeholder="Nhập mật khẩu..."]').type('wrong_pass');
    cy.get('button').contains('Đăng Nhập').click();

    // Kì vọng: hiển thị thông báo lỗi
    cy.get('.login-error').should('be.visible');

    // Vẫn ở trang login
    cy.url().should('include', '/login');
  });

  it('AUTH-03: Truy cập URL bảo mật khi chưa đăng nhập → API trả 401', () => {
    // App không dùng route guard, mà dùng API interceptor (401 → redirect /login)
    // Khi không có token, trang sẽ render nhưng API calls fail → redirect
    cy.visit('/admin/users');

    // Chờ redirect xảy ra sau khi API interceptor xử lý 401
    cy.url({ timeout: 10000 }).should('include', '/login');
  });

  it('AUTH-04: Đăng xuất → xóa token và quay về login', () => {
    // Đăng nhập trước
    cy.login('giaovien', '123456');
    cy.url().should('eq', Cypress.config().baseUrl + '/');

    // Bấm nút đăng xuất
    cy.contains('Đăng xuất').click();

    // Kì vọng quay về login
    cy.url().should('include', '/login');
  });
});
