import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated/room-booking-api";
import { ForbiddenError, authorizationHeader, classifyResponse } from "./authz/client";

// The 401 rule lives in src/authz/client.ts; this module adds nothing of its own
// about authorization.
const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const header = await authorizationHeader();
    if (header) request.headers.set("Authorization", header);
    return request;
  },
  async onResponse({ response }) {
    if ((await classifyResponse(response.status)) === "forbidden") {
      throw new ForbiddenError(response.status);
    }
    return response;
  },
};

// Same-origin: nginx strips `/api` and proxies to the API gateway.
export const roomBookingApi = createClient<paths>({ baseUrl: "/api" });
roomBookingApi.use(authMiddleware);
