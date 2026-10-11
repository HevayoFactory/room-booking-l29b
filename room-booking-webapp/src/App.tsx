import { useEffect, type ReactElement } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Box, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import {
  AuthzProvider,
  Forbidden,
  NoAccess,
  RequireOperation,
  useAuthz,
  useScopes,
} from "./authz/gates";
import { SCREEN_ROUTES, hasScopedReach, reachableScreens } from "./authz/screens";
import { setForbiddenNavigator } from "./authz/client";
import { signIn } from "./authz/session";
import { APP_NAME } from "./appName";
import { AppLayout } from "./shell/AppLayout";
import { GateLayout } from "./shell/GateLayout";
import { CallbackPage } from "./pages/Callback";
import { AvailabilityPage } from "./pages/Availability";
import { BookRoomPage } from "./pages/BookRoom";
import { MyBookingsPage } from "./pages/MyBookings";
import { ManageRoomsPage } from "./pages/ManageRooms";
import { AccountPage } from "./pages/Account";
import { SignedOutPage } from "./pages/SignedOut";

/** Pages keyed by the screen keys src/authz/screens.ts declares. */
const PAGE_BY_KEY: Record<string, ReactElement> = {
  availability: <AvailabilityPage />,
  book: <BookRoomPage />,
  "my-bookings": <MyBookingsPage />,
  rooms: <ManageRoomsPage />,
  account: <AccountPage />,
  "signed-out": <SignedOutPage />,
};

const PUBLIC_SCREENS = SCREEN_ROUTES.filter((screen) => screen.public);

export function App(): ReactElement {
  return (
    <>
      <ForbiddenWiring />
      <Routes>
        <Route path="/callback" element={<CallbackPage />} />
        {PUBLIC_SCREENS.map((screen) => (
          <Route
            key={screen.key}
            element={
              <AuthzProvider fallback={<Splash />}>
                <GateLayout />
              </AuthzProvider>
            }
          >
            <Route path={screen.path} element={PAGE_BY_KEY[screen.key]} />
          </Route>
        ))}
        <Route
          path="*"
          element={
            <AuthzProvider fallback={<Splash />}>
              <SignedIn />
            </AuthzProvider>
          }
        />
      </Routes>
    </>
  );
}

/** Hands src/authz/client.ts the route a refusal goes to; replace keeps Back out of the loop. */
function ForbiddenWiring(): null {
  const navigate = useNavigate();
  useEffect(() => {
    setForbiddenNavigator(() => navigate("/forbidden", { replace: true }));
  }, [navigate]);
  return null;
}

function Splash(): ReactElement {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ minHeight: "100vh" }}>
      <Typography variant="h5">{APP_NAME}</Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Checking your session…
        </Typography>
      </Box>
    </Stack>
  );
}

function SignedIn(): ReactElement {
  const { signedIn } = useAuthz();
  const scopes = useScopes();

  useEffect(() => {
    if (!signedIn) void signIn();
  }, [signedIn]);

  if (!signedIn) return <Splash />;

  const reachable = reachableScreens(scopes, signedIn);

  // NoAccess replaces the shell: nothing is reachable, so no rail is drawn.
  if (!hasScopedReach(scopes, signedIn)) {
    return (
      <GateLayout>
        <NoAccess appName={APP_NAME} />
      </GateLayout>
    );
  }

  const landing = (reachable.find((s) => !s.public && s.loads !== null) ?? reachable[0]).path;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to={landing} replace />} />
        {SCREEN_ROUTES.map((screen) => {
          if (screen.public) return null;
          const page = PAGE_BY_KEY[screen.key];
          if (screen.loads === null) {
            return <Route key={screen.key} path={screen.path} element={page} />;
          }
          return (
            <Route
              key={screen.key}
              element={<RequireOperation op={screen.loads} screen={screen.label} />}
            >
              <Route path={screen.path} element={page} />
            </Route>
          );
        })}
        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<Navigate to={landing} replace />} />
      </Route>
    </Routes>
  );
}
