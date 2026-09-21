const { parsePagination, paginatedResponse } = require('../src/utils/pagination');

describe('parsePagination', () => {
  it('applies defaults when no query params given', () => {
    const { page, limit, skip } = parsePagination({});
    expect(page).toBe(1);
    expect(limit).toBe(20);
    expect(skip).toBe(0);
  });

  it('parses valid page/limit and computes skip', () => {
    const { page, limit, skip } = parsePagination({ page: '3', limit: '10' });
    expect(page).toBe(3);
    expect(limit).toBe(10);
    expect(skip).toBe(20);
  });

  it('caps limit at maxLimit', () => {
    const { limit } = parsePagination({ limit: '9999' }, { maxLimit: 50 });
    expect(limit).toBe(50);
  });

  it('floors page at 1 for invalid/negative input', () => {
    const { page } = parsePagination({ page: '-5' });
    expect(page).toBe(1);
  });
});

describe('paginatedResponse', () => {
  it('computes totalPages correctly', () => {
    const result = paginatedResponse({ data: [1, 2], total: 45, page: 2, limit: 20 });
    expect(result.pagination).toEqual({ total: 45, page: 2, limit: 20, totalPages: 3 });
  });

  it('handles zero total without dividing by zero issues', () => {
    const result = paginatedResponse({ data: [], total: 0, page: 1, limit: 20 });
    expect(result.pagination.totalPages).toBe(1);
  });
});
