import type { ReactElement } from "react";
import { PageContent, PageTitle, Typography } from "@wso2/oxygen-ui";

/** Foundation placeholder: the routed screen exists inside the shell; a later item fills it. */
export function Placeholder({ title }: { title: string }): ReactElement {
  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>{title}</PageTitle.Header>
      </PageTitle>
      <Typography variant="body2" color="text.secondary">
        This screen is not built yet.
      </Typography>
    </PageContent>
  );
}
