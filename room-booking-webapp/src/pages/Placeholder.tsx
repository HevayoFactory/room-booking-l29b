import type { ReactElement } from "react";
import { Alert, PageContent, PageTitle } from "@wso2/oxygen-ui";

/** Foundation stand-in for a screen a later item builds. */
export function Placeholder({ title }: { title: string }): ReactElement {
  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>{title}</PageTitle.Header>
      </PageTitle>
      <Alert severity="info">This screen is not built yet.</Alert>
    </PageContent>
  );
}
