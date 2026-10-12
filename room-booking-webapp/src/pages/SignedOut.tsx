import type { ReactElement } from "react";
import { Box, Button, Layout, ParticleBackground, Stack, Typography } from "@wso2/oxygen-ui";
import { signIn } from "../authz/session";

/** Drawn on a bare Screen root: public, no shell. */
export function SignedOutPage(): ReactElement {
  return (
    <Layout.Content>
      <ParticleBackground opacity={0.5} />
      <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Stack spacing={3} alignItems="center">
          <Typography variant="h4">You are signed out</Typography>
          <Button variant="contained" onClick={() => void signIn()}>
            Sign in
          </Button>
        </Stack>
      </Box>
    </Layout.Content>
  );
}
