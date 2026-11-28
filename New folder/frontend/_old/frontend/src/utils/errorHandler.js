/**
 * Normalizes backend error responses across Identity, Equipment, and Booking services.
 */
export const getErrorMessage = (err, fallbackMessage = 'An unexpected error occurred. Please try again.') => {
  if (!err) return fallbackMessage;

  // Axios network or timeout failure
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return 'The request timed out. The backend service may be under load or unavailable.';
  }

  if (err.message === 'Network Error' || !err.response) {
    return 'Unable to reach the backend service. Please check if the microservice is running.';
  }

  const responseData = err.response.data;

  // Handle { success: false, error: { message, code } }
  // or { error: { message, code, details } }
  if (responseData?.error?.message) {
    let msg = responseData.error.message;
    if (Array.isArray(responseData.error.details) && responseData.error.details.length > 0) {
      const detailsMsg = responseData.error.details.map((d) => d.message || d.msg).join(', ');
      msg = `${msg}: ${detailsMsg}`;
    }
    return msg;
  }

  // Handle express-validator { message, errors: [...] } or { errors: [...] }
  if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
    const errorList = responseData.errors.map((e) => e.message || e.msg || e).join(', ');
    return responseData.message ? `${responseData.message}: ${errorList}` : errorList;
  }

  // Handle direct string message or status code
  if (responseData?.message) {
    return responseData.message;
  }

  if (err.response.status === 401) {
    return 'Your session has expired or you are not logged in. Please log in again.';
  }

  if (err.response.status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (err.response.status === 404) {
    return 'The requested resource was not found.';
  }

  if (err.response.status === 409) {
    return 'A conflict occurred with existing records or reservations.';
  }

  if (err.response.status === 503) {
    return 'A downstream dependency or microservice is currently unavailable.';
  }

  return fallbackMessage;
};
