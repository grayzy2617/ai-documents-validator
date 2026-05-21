// ***********************************************
// Custom Cypress Commands cho QLDA
// ***********************************************

/**
 * Custom command để đăng nhập nhanh.
 * Sử dụng: cy.login('username', 'password')
 */
Cypress.Commands.add('login', (username, password) => {
  cy.visit('/login');
  cy.get('input[placeholder="Nhập username..."]').clear().type(username);
  cy.get('input[placeholder="Nhập mật khẩu..."]').clear().type(password);
  cy.get('button').contains('Đăng Nhập').click();
});

/**
 * Custom command để đăng nhập bằng API trực tiếp (nhanh, skip UI).
 * Sử dụng: cy.loginViaApi('username', 'password')
 */
Cypress.Commands.add('loginViaApi', (username, password) => {
  cy.request({
    method: 'POST',
    url: 'http://localhost:8000/login',
    form: true,
    body: {
      username: username,
      password: password,
    },
  }).then((resp) => {
    expect(resp.status).to.eq(200);
    window.localStorage.setItem('token', resp.body.access_token);
  });
});
