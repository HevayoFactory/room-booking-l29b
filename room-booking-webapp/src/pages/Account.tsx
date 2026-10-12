import { useEffect, useState, type ReactElement } from "react";
import { Card, CardContent, CardHeader, Grid, PageContent, PageTitle, Typography } from "@wso2/oxygen-ui";
import { currentUser } from "../authz/session";
import { useAuthz, useHeldRoles } from "../authz/gates";

function Field({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Grid size={{ xs: 12, md: 4 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value || "—"}</Typography>
    </Grid>
  );
}

export function AccountPage(): ReactElement {
  const { username } = useAuthz();
  const roles = useHeldRoles();
  const [email, setEmail] = useState("");
  useEffect(() => {
    void currentUser().then((u) => {
      const e = u?.profile?.email;
      if (typeof e === "string") setEmail(e);
    });
  }, []);
  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Account</PageTitle.Header>
      </PageTitle>
      <Card variant="outlined">
        <CardHeader title="Your account" />
        <CardContent>
          <Grid container spacing={2}>
            <Field label="Name" value={username} />
            <Field label="Email" value={email} />
            <Field label="Role" value={roles.join(", ")} />
          </Grid>
        </CardContent>
      </Card>
    </PageContent>
  );
}
