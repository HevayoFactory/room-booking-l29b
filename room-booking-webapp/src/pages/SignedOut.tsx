import type { ReactElement } from "react";
import { Button, Stack, Typography } from "@wso2/oxygen-ui";
import { signIn } from "../authz/session";

export function SignedOutPage(): ReactElement {
  return (
    <Stack spacing={3} alignItems="center">
      <Typography variant="h4">You are signed out</Typography>
      <Button variant="contained" onClick={() => void signIn()}>
        Sign in
      </Button>
    </Stack>
  );
}
