// What the platform emits into window._env_ for this app: the user-auth keys only.
export const mockEnv = {
  USER_AUTH_CLIENT_ID: "mock-client",
  USER_AUTH_ISSUER: "https://mock-idp.test",
  USER_AUTH_SCOPES:
    "openid profile email group ou rooms:read rooms:manage bookings:read-all bookings:read bookings:create bookings:cancel bookings:cancel-any",
  USER_AUTH_RESOURCE: "https://mock-idp.test/resources/mock-project",
};
