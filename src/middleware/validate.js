import { validationResult } from 'express-validator';
import { sendBadRequest } from '../utils/apiResponse.js';

// Runs after any express-validator rule chain.
// If there are errors it stops the request and returns them in a clean format.
// If no errors it calls next() and the request continues to the controller.

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map(e => ({
      field:   e.path,
      message: e.msg,
    }));
    return sendBadRequest(res, 'Validation failed', formatted);
  }
  next();
};

export default validate;
