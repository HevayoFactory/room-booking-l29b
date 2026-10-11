import { useEffect, useRef, type ReactElement } from "react";
import { Stack, Typography } from "@wso2/oxygen-ui";
import { handleCallback } from "../authz/session";

/** Finishes the OIDC redirect once, then lands on the app root. */
export function CallbackPage(): ReactElement {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void handleCallback().then(() => window.location.replace("/"));
  }, []);
  return (
    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: "100vh" }}>
      <Typography variant="body2" color="text.secondary">
        Signing you in…
      </Typography>
    </Stack>
  );
}
