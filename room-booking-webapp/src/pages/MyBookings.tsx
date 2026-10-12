import { useCallback, useEffect, useState, type ReactElement } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  ListingTable,
  PageContent,
  PageTitle,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { roomBookingApi } from "../api";
import { ForbiddenError } from "../authz/client";
import { Can } from "../authz/gates";
import type { components } from "../generated/room-booking-api";

type Booking = components["schemas"]["Booking"];

const DELAYED_MS = 3000;
const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
const hourLabel = (h: number): string => `${pad(h)}:00`;
const isoDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function MyBookingsPage(): ReactElement {
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "failed">("loading");
  const [rows, setRows] = useState<Booking[]>([]);
  const [delayed, setDelayed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await roomBookingApi.GET("/me/bookings", { params: { query: { limit: 100 } } });
      if (!res.data) return setState("failed");
      setRows(res.data.data);
      setState("ready");
    } catch (err) {
      setState(err instanceof ForbiddenError ? "forbidden" : "failed");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state !== "loading") {
      setDelayed(false);
      return;
    }
    const t = setTimeout(() => setDelayed(true), DELAYED_MS);
    return () => clearTimeout(t);
  }, [state]);

  const now = new Date();
  const today = isoDay(now);
  const nowHour = now.getHours();
  const upcoming = (b: Booking): boolean => b.date > today || (b.date === today && b.endHour > nowHour);

  const cancel = async (id: string): Promise<void> => {
    setBusyId(id);
    setCancelError(null);
    try {
      const res = await roomBookingApi.POST("/me/bookings/{bookingId}/cancel", {
        params: { path: { bookingId: id } },
      });
      if (!res.data) {
        setCancelError(
          res.response.status === 404
            ? "That booking can no longer be cancelled."
            : "The booking was not cancelled. Try again in a few minutes.",
        );
      }
      await load();
    } catch (err) {
      if (err instanceof ForbiddenError) throw err;
      setCancelError("The booking was not cancelled. Try again in a few minutes.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>My bookings</PageTitle.Header>
        <PageTitle.Actions>
          <Can op="POST /me/bookings">
            <Button variant="contained" component={RouterLink} to="/book">
              Book a room
            </Button>
          </Can>
        </PageTitle.Actions>
      </PageTitle>

      {state === "failed" && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Bookings unavailable</AlertTitle>
          We could not load your bookings. Try again in a few minutes.
        </Alert>
      )}
      {cancelError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Not cancelled</AlertTitle>
          {cancelError}
        </Alert>
      )}
      {delayed && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This is taking longer than usual. Hang on.
        </Alert>
      )}

      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="h6">Upcoming</Typography>
          {state === "ready" && <Chip size="small" label={rows.length} />}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Cancelled bookings stay listed until their day has passed.
        </Typography>
        <ListingTable.Container>
          <ListingTable>
            <ListingTable.Head>
              <ListingTable.Row>
                <ListingTable.Cell>Room</ListingTable.Cell>
                <ListingTable.Cell>Day</ListingTable.Cell>
                <ListingTable.Cell>Time</ListingTable.Cell>
                <ListingTable.Cell>Title</ListingTable.Cell>
                <ListingTable.Cell>Status</ListingTable.Cell>
                <ListingTable.Cell>Note</ListingTable.Cell>
                <ListingTable.Cell />
              </ListingTable.Row>
            </ListingTable.Head>
            <ListingTable.Body>
              {state === "loading" && (
                <ListingTable.Row>
                  <ListingTable.Cell colSpan={7} align="center">
                    <CircularProgress size={20} />
                  </ListingTable.Cell>
                </ListingTable.Row>
              )}
              {state === "forbidden" && (
                <ListingTable.Row>
                  <ListingTable.Cell colSpan={7}>
                    <ListingTable.EmptyState
                      title="Not available to you"
                      description="Your roles do not include viewing bookings."
                    />
                  </ListingTable.Cell>
                </ListingTable.Row>
              )}
              {state === "ready" && rows.length === 0 && (
                <ListingTable.Row>
                  <ListingTable.Cell colSpan={7}>
                    <Card variant="outlined">
                      <CardContent>
                        <ListingTable.EmptyState
                          title="No upcoming bookings"
                          description="Book a room to see it here."
                          action={
                            <Can op="POST /me/bookings">
                              <Button variant="contained" component={RouterLink} to="/book">
                                Book a room
                              </Button>
                            </Can>
                          }
                        />
                      </CardContent>
                    </Card>
                  </ListingTable.Cell>
                </ListingTable.Row>
              )}
              {rows.map((b) => {
                const cancelled = b.status === "cancelled";
                const note = cancelled
                  ? `Cancelled by ${b.cancelledBy === "facilities" ? "facilities" : "you"}${
                      b.cancelReason ? `: ${b.cancelReason}` : ""
                    }`
                  : "";
                return (
                  <ListingTable.Row key={b.id}>
                    <ListingTable.Cell>{b.roomName}</ListingTable.Cell>
                    <ListingTable.Cell>{b.date}</ListingTable.Cell>
                    <ListingTable.Cell>{`${hourLabel(b.startHour)} to ${hourLabel(b.endHour)}`}</ListingTable.Cell>
                    <ListingTable.Cell>{b.title || "Untitled"}</ListingTable.Cell>
                    <ListingTable.Cell>
                      <Chip
                        size="small"
                        label={cancelled ? "Cancelled" : "Booked"}
                        color={cancelled ? "error" : "success"}
                      />
                    </ListingTable.Cell>
                    <ListingTable.Cell>{note}</ListingTable.Cell>
                    <ListingTable.Cell align="right">
                      {!cancelled && upcoming(b) && (
                        <Can op="POST /me/bookings/{bookingId}/cancel">
                          <Button
                            size="small"
                            variant="text"
                            color="error"
                            disabled={busyId === b.id}
                            onClick={() => void cancel(b.id)}
                          >
                            Cancel
                          </Button>
                        </Can>
                      )}
                    </ListingTable.Cell>
                  </ListingTable.Row>
                );
              })}
            </ListingTable.Body>
          </ListingTable>
        </ListingTable.Container>
      </Box>
    </PageContent>
  );
}
