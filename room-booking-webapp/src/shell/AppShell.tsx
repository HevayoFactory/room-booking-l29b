import { useEffect, useState, type ReactElement } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppShell,
  ColorSchemeToggle,
  Divider,
  Footer,
  Header,
  Sidebar,
  UserMenu,
} from "@wso2/oxygen-ui";
import { CalendarDays, CalendarPlus, DoorOpen, ListChecks, User } from "@wso2/oxygen-ui-icons-react";
import { APP_NAME } from "../appName";
import { Can, useAuthz, useHeldRoles } from "../authz/gates";
import { SCREEN_ROUTES } from "../authz/screens";
import { currentUser, signOut } from "../authz/session";

const NAV_ICONS: Record<string, ReactElement> = {
  availability: <CalendarDays />,
  book: <CalendarPlus />,
  "my-bookings": <ListChecks />,
  rooms: <DoorOpen />,
};

// The rail, in screen order. Each item is wrapped in <Can> on the operation its
// screen loads, so one rail shows each role its own entries.
const NAV = SCREEN_ROUTES.filter((s) => s.key in NAV_ICONS);

export function AppLayout(): ReactElement {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { username } = useAuthz();
  const roles = useHeldRoles();
  const [email, setEmail] = useState("");
  useEffect(() => {
    void currentUser().then((u) => {
      const e = u?.profile?.email;
      if (typeof e === "string") setEmail(e);
    });
  }, []);

  const active = NAV.find((s) => pathname.startsWith(s.path))?.key;
  const name = username || "Signed in";

  return (
    <AppShell>
      <AppShell.Navbar>
        <Header>
          <Header.Toggle />
          <Header.Brand>
            <Header.BrandTitle>{APP_NAME}</Header.BrandTitle>
          </Header.Brand>
          <Header.Spacer />
          <Header.Actions>
            <ColorSchemeToggle />
            <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
            <UserMenu>
              <UserMenu.Trigger name={name} />
              <UserMenu.Header name={name} email={email} role={roles.join(", ") || undefined} />
              <UserMenu.Item icon={<User />} label="Account" onClick={() => navigate("/account")} />
              <UserMenu.Divider />
              <UserMenu.Logout label="Sign out" onClick={() => void signOut()} />
            </UserMenu>
          </Header.Actions>
        </Header>
      </AppShell.Navbar>

      <AppShell.Sidebar>
        <Sidebar activeItem={active}>
          <Sidebar.Nav>
            <Sidebar.Category>
              {NAV.map((screen) => (
                <Can key={screen.key} op={screen.loads!}>
                  <Sidebar.Item id={screen.key} link={<Link to={screen.path} />}>
                    <Sidebar.ItemIcon>{NAV_ICONS[screen.key]}</Sidebar.ItemIcon>
                    <Sidebar.ItemLabel>{screen.label}</Sidebar.ItemLabel>
                  </Sidebar.Item>
                </Can>
              ))}
            </Sidebar.Category>
          </Sidebar.Nav>
        </Sidebar>
      </AppShell.Sidebar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer>
        <Footer>
          <Footer.Copyright>© WSO2 LLC</Footer.Copyright>
        </Footer>
      </AppShell.Footer>
    </AppShell>
  );
}
