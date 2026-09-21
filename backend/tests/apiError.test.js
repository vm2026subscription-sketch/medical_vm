const ApiError = require('../src/utils/ApiError');

describe('ApiError', () => {
  it('creates a badRequest with 400 status', () => {
    const err = ApiError.badRequest('bad input', { field: 'x' });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('bad input');
    expect(err.details).toEqual({ field: 'x' });
    expect(err.isOperational).toBe(true);
  });

  it('creates unauthorized/forbidden/notFound/conflict with correct codes', () => {
    expect(ApiError.unauthorized().statusCode).toBe(401);
    expect(ApiError.forbidden().statusCode).toBe(403);
    expect(ApiError.notFound().statusCode).toBe(404);
    expect(ApiError.conflict().statusCode).toBe(409);
  });

  it('is an instance of Error', () => {
    const err = ApiError.internal('boom');
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(500);
  });
});
