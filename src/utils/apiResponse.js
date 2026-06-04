/**
 * API Response Helpers
 * ─────────────────────────────────────────────────────────────
 * Every response from this API follows the same shape so the
 * React frontend (and Redux RTK Query) can handle it uniformly.
 *
 * Success shape:  { success: true,  message, data }
 * Error shape:    { success: false, message, errors? }
 */

export const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

export const sendCreated = (res, data = {}, message = 'Created successfully') =>
  sendSuccess(res, data, message, 201);

export const sendError = (res, message = 'Something went wrong', statusCode = 500, errors = []) => {
  const body = { success: false, message };
  if (errors.length) body.errors = errors;
  return res.status(statusCode).json(body);
};

export const sendBadRequest   = (res, message = 'Bad request', errors = [])   => sendError(res, message, 400, errors);
export const sendUnauthorized = (res, message = 'Unauthorized')                => sendError(res, message, 401);
export const sendForbidden    = (res, message = 'Forbidden')                   => sendError(res, message, 403);
export const sendNotFound     = (res, message = 'Resource not found')          => sendError(res, message, 404);
export const sendConflict     = (res, message = 'Conflict')                    => sendError(res, message, 409);
