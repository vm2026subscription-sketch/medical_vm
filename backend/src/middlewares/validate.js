const ApiError = require('../utils/ApiError');

/**
 * validate(schema) — validates req.body/query/params against a Zod schema shaped as
 * { body?, query?, params? }. Replaces req fields with the parsed (typed/defaulted) values.
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.query) req.query = schema.query.parse(req.query);
      if (schema.params) req.params = schema.params.parse(req.params);
      next();
    } catch (err) {
      next(ApiError.badRequest('Invalid request', err.errors || err.message));
    }
  };
}

module.exports = validate;
