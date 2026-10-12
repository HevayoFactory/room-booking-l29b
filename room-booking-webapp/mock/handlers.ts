import type { RequestHandler } from "msw";

// Foundation ships no feature handlers: the screens are placeholders and call
// no operation. F1-F3 add one handler per operation of room-booking-api's
// openapi.yaml here (paths carry the `/api` prefix, most specific first), seeded
// from the records in prototype.tsx. State lives in module scope: a full page
// load resets it to the seed data.
//
// The caller this mock speaks for, shaped like the gateway assertion. Handlers
// under `/api/me/…` resolve rows through it, never through a query parameter.
export const mockCaller = {
  userId: "01a0ab00-0000-7000-8000-000000000001",
  username: "mock-staff",
};

export const handlers: RequestHandler[] = [];
