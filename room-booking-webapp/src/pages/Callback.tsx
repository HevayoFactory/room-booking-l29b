import { useEffect, useRef, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, CircularProgress } from "@wso2/oxygen-ui";
import { useState } from "react";
import { handleCallback } from "../authz/session";

/** OIDC redirect target. signinCallback() serves both the redirect and the silent-renew leg. */
export function CallbackPage(): ReactElement {
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    handleCallback()
      .then(() => {
        // In the silent-renew iframe the parent window takes over; nothing to navigate.
        if (window.parent === window) navigate("/", { replace: true });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Sign-in failed"));
  }, [navigate]);

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">Sign-in failed: {error}</Alert>
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 12 }}>
      <CircularProgress />
    </Box>
  );
}
