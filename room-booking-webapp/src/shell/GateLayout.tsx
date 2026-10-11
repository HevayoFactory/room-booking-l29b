import type { ReactElement, ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { Box, Layout, ParticleBackground } from "@wso2/oxygen-ui";

/** Unauthenticated / no-shell layout: Signed out and NoAccess. */
export function GateLayout({ children }: { children?: ReactNode }): ReactElement {
  return (
    <Layout.Content>
      <ParticleBackground opacity={0.5} />
      <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children ?? <Outlet />}
      </Box>
    </Layout.Content>
  );
}
