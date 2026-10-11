import { useEffect, useState, type ReactElement } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppShell,
  ColorSchemeToggle,
  Divider,
  Footer,
  Header,
  Sidebar,
} from "@wso2/oxygen-ui";
import { UserMenu } from "@wso2/oxygen-ui";
import { CalendarDays, DoorOpen, LogOut, Search, Ticket, User } from "@wso2/oxygen-ui-icons-react";
import { Can, useAuthz, useHeldRoles } from "../authz/gates";
import { currentUser, signOut } from "../authz/session";
import { SCREEN_ROUTES } from "../authz/screens";
import { APP_NAME } from "../appName";

const PATH = Object.fromEntries(SCREEN_ROUTES.map((s) => [s.key, s.path])) as Record<string, string>;

const ROLE_LABEL: Record<string, string> = { Staff: "Staff", FacilitiesAdmin: "Facilities admin" };

/** The app shell: brand + account in the header, ONE sidebar rail whose items are each gated. */
export function AppLayout(): ReactElement {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { username } = useAuthz();
  const roles = useHeldRoles();
  const [email, setEmail] = useState("");

  useEffect(() => {
    void currentUser().then((user) => {
      const value = user?.profile?.email;
      if (typeof value === "string") setEmail(value);
    });
  }, []);

  const active =
    SCREEN_ROUTES.find((s) => !s.public && pathname.startsWith(s.path))?.key ?? "";
  const name = username || email || "Signed in";

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
              <UserMenu.Header
                name={name}
                email={email}
                role={roles.map((r) => ROLE_LABEL[r] ?? r).join(", ") || undefined}
              />
              <UserMenu.Item icon={<User />} label="Account" onClick={() => navigate(PATH.account)} />
              <UserMenu.Divider />
              <UserMenu.Logout icon={<LogOut />} label="Sign out" onClick={() => void signOut()} />
            </UserMenu>
          </Header.Actions>
        </Header>
      </AppShell.Navbar>

      <AppShell.Sidebar>
        <Sidebar activeItem={active}>
          <Sidebar.Nav>
            <Sidebar.Category>
              <Can
                op="POST /me/bookings"
                fallback={
                  <Sidebar.Item id="availability" link={<Link to={PATH.availability} />}>
                    <Sidebar.ItemIcon>
                      <CalendarDays />
                    </Sidebar.ItemIcon>
                    <Sidebar.ItemLabel>Availability</Sidebar.ItemLabel>
                  </Sidebar.Item>
                }
              >
                <Sidebar.Item id="availability" link={<Link to={PATH.availability} />}>
                  <Sidebar.ItemIcon>
                    <Search />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Find a room</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
              <Can op="POST /me/bookings">
                <Sidebar.Item id="book" link={<Link to={PATH.book} />}>
                  <Sidebar.ItemIcon>
                    <DoorOpen />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Book a room</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
              <Can op="GET /me/bookings">
                <Sidebar.Item id="my-bookings" link={<Link to={PATH["my-bookings"]} />}>
                  <Sidebar.ItemIcon>
                    <Ticket />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>My bookings</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
              <Can op="GET /admin/rooms">
                <Sidebar.Item id="rooms" link={<Link to={PATH.rooms} />}>
                  <Sidebar.ItemIcon>
                    <DoorOpen />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Manage rooms</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
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
