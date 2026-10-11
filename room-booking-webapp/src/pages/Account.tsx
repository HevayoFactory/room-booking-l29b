import { useEffect, useState, type ReactElement } from "react";
import { Card, CardContent, CardHeader, Grid, PageContent, PageTitle, Typography } from "@wso2/oxygen-ui";
import { useAuthz, useHeldRoles } from "../authz/gates";
import { currentUser } from "../authz/session";

const ROLE_LABEL: Record<string, string> = { Staff: "Staff", FacilitiesAdmin: "Facilities admin" };

export function AccountPage(): ReactElement {
  const { username } = useAuthz();
  const roles = useHeldRoles();
  const [email, setEmail] = useState("");

  useEffect(() => {
    void currentUser().then((user) => {
      const value = user?.profile?.email;
      if (typeof value === "string") setEmail(value);
    });
  }, []);

  const fields = [
    { label: "Name", value: username },
    { label: "Email", value: email },
    { label: "Role", value: roles.map((r) => ROLE_LABEL[r] ?? r).join(", ") },
  ];

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Account</PageTitle.Header>
      </PageTitle>
      <Card variant="outlined">
        <CardHeader title="Your account" />
        <CardContent>
          <Grid container spacing={2}>
            {fields.map((f) => (
              <Grid key={f.label} size={{ xs: 12, md: 4 }}>
                <Typography variant="overline" color="text.secondary">
                  {f.label}
                </Typography>
                <Typography variant="body2">{f.value || "—"}</Typography>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </PageContent>
  );
}
