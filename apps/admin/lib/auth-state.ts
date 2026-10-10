// Internal header the proxy adds to the request it forwards, so the page can
// tell why there is no usable session. The proxy removes any client-sent copy
// first, so it can't be spoofed from the browser.
export const AUTH_STATE_HEADER = 'x-gs-auth-state';

export const AUTH_STATE = {
  // The API couldn't be reached or failed: the session may still be fine.
  unavailable: 'unavailable',
  // The proxy found no usable session for this request's tokens: the refresh
  // was refused, or the session was ended here (logout) while it was in flight.
  none: 'none',
} as const;
