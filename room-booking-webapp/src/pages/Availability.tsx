import { useEffect, useMemo, useState, type ReactElement } from "react";
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ListingTable,
  PageContent,
  PageTitle,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { roomBookingApi } from "../api";
import { ForbiddenError } from "../authz/client";
import { Can, useAuthz } from "../authz/gates";
import { canCall } from "../authz/core";
import { OPERATIONS } from "../authz/operations.gen";
import type { components } from "../generated/room-booking-api";

type Room = components["schemas"]["Room"];
type Booking = components["schemas"]["Booking"];

// Bookable hours: 08:00 to 18:00 in one-hour slots, up to 30 days ahead.
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const DAYS_AHEAD = 30;
const PAGE_LIMIT = 100;
const DELAYED_MS = 3000;

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
const hourLabel = (h: number): string => `${pad(h)}:00`;
const isoDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type Load<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "forbidden" }
  | { status: "failed" };

/** Runs `fetcher` whenever `key` changes; `null` fetcher means nothing to load. */
function useLoad<T>(key: string, fetcher: (() => Promise<T>) | null): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  useEffect(() => {
    if (!fetcher) return;
    let live = true;
    setState({ status: "loading" });
    fetcher().then(
      (data) => live && setState({ status: "ready", data }),
      (err: unknown) => live && setState({ status: err instanceof ForbiddenError ? "forbidden" : "failed" }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

function useDelayed(pending: boolean): boolean {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!pending) {
      setDelayed(false);
      return;
    }
    const t = setTimeout(() => setDelayed(true), DELAYED_MS);
    return () => clearTimeout(t);
  }, [pending]);
  return delayed;
}

export function AvailabilityPage(): ReactElement {
  const { scopes, signedIn } = useAuthz();
  // Admins load every room (inactive included); staff load the active ones.
  const seesInactive = canCall(OPERATIONS["GET /admin/rooms"], scopes, signedIn);

  const todayDate = new Date();
  const today = isoDay(todayDate);
  const lastDay = isoDay(new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + DAYS_AHEAD));
  const nowHour = todayDate.getHours();

  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState(today);

  const rooms = useLoad<Room[]>(`rooms:${seesInactive}`, async () => {
    const res = seesInactive
      ? await roomBookingApi.GET("/admin/rooms", { params: { query: { limit: PAGE_LIMIT } } })
      : await roomBookingApi.GET("/rooms", { params: { query: { limit: PAGE_LIMIT } } });
    if (!res.data) throw new Error("rooms failed");
    return res.data.data;
  });
  const roomsDelayed = useDelayed(rooms.status === "loading");

  const roomList = rooms.status === "ready" ? rooms.data : [];
  const room = roomList.find((r) => r.id === roomId) ?? roomList[0];
  const outOfRange = date < today || date > lastDay;
  const slotsKey = room && date && !outOfRange ? `${room.id}:${date}` : "";

  const [reloadTick, setReloadTick] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelFailed, setCancelFailed] = useState(false);
  const bookings = useLoad<Booking[]>(
    `bookings:${slotsKey}:${reloadTick}`,
    slotsKey && room
      ? async () => {
          const res = await roomBookingApi.GET("/bookings", {
            params: { query: { roomId: room.id, date, limit: PAGE_LIMIT } },
          });
          if (!res.data) throw new Error("bookings failed");
          return res.data.data;
        }
      : null,
  );
  const bookingsDelayed = useDelayed(slotsKey !== "" && bookings.status === "loading");

  const slots = useMemo(() => {
    const list = bookings.status === "ready" && slotsKey ? bookings.data : [];
    return HOURS.map((h) => {
      const booking = list.find((b) => b.status === "active" && b.startHour <= h && h < b.endHour);
      const past = date < today || (date === today && h < nowHour);
      return { h, booking, past };
    });
  }, [bookings, slotsKey, date, today, nowHour]);

  const closeCancel = (): void => {
    if (cancelling) return;
    setCancelTarget(null);
    setReason("");
    setCancelFailed(false);
  };
  const confirmCancel = async (): Promise<void> => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelFailed(false);
    try {
      const trimmed = reason.trim();
      const res = await roomBookingApi.POST("/bookings/{bookingId}/cancel", {
        params: { path: { bookingId: cancelTarget.id } },
        body: { reason: trimmed || null },
      });
      if (res.response.ok || res.response.status === 404) {
        // 404: already cancelled or no longer upcoming; either way the slot view is stale.
        setCancelTarget(null);
        setReason("");
        setReloadTick((n) => n + 1);
      } else {
        setCancelFailed(true);
      }
    } catch (err) {
      if (!(err instanceof ForbiddenError)) setCancelFailed(true);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Rooms and availability</PageTitle.Header>
      </PageTitle>

      {(rooms.status === "failed" || bookings.status === "failed") && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Availability unavailable</AlertTitle>
          We could not load bookings. Try again in a few minutes.
        </Alert>
      )}
      {(roomsDelayed || bookingsDelayed) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This is taking longer than usual. Hang on.
        </Alert>
      )}

      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Rooms</Typography>
            {rooms.status === "ready" && <Chip size="small" label={roomList.length} />}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Pick a room to see its slots.
          </Typography>
          <ListingTable.Container>
            <ListingTable>
              <ListingTable.Head>
                <ListingTable.Row>
                  <ListingTable.Cell>Room</ListingTable.Cell>
                  <ListingTable.Cell align="right">Capacity</ListingTable.Cell>
                  <ListingTable.Cell>Location</ListingTable.Cell>
                  <ListingTable.Cell>Status</ListingTable.Cell>
                </ListingTable.Row>
              </ListingTable.Head>
              <ListingTable.Body>
                {rooms.status === "loading" && (
                  <ListingTable.Row>
                    <ListingTable.Cell colSpan={4} align="center">
                      <CircularProgress size={20} />
                    </ListingTable.Cell>
                  </ListingTable.Row>
                )}
                {rooms.status === "forbidden" && (
                  <ListingTable.Row>
                    <ListingTable.Cell colSpan={4}>
                      <ListingTable.EmptyState
                        title="Not available to you"
                        description="Your roles do not include viewing rooms."
                      />
                    </ListingTable.Cell>
                  </ListingTable.Row>
                )}
                {rooms.status === "ready" && roomList.length === 0 && (
                  <ListingTable.Row>
                    <ListingTable.Cell colSpan={4}>
                      <ListingTable.EmptyState title="No rooms yet" description="Facilities will add rooms soon." />
                    </ListingTable.Cell>
                  </ListingTable.Row>
                )}
                {roomList.map((r) => (
                  <ListingTable.Row
                    key={r.id}
                    clickable
                    hover
                    selected={room?.id === r.id}
                    onClick={() => setRoomId(r.id)}
                  >
                    <ListingTable.Cell>{r.name}</ListingTable.Cell>
                    <ListingTable.Cell align="right">{r.capacity}</ListingTable.Cell>
                    <ListingTable.Cell>{r.location}</ListingTable.Cell>
                    <ListingTable.Cell>
                      <Chip
                        size="small"
                        label={r.active ? "Active" : "Inactive"}
                        color={r.active ? "success" : "default"}
                        variant={r.active ? "filled" : "outlined"}
                      />
                    </ListingTable.Cell>
                  </ListingTable.Row>
                ))}
              </ListingTable.Body>
            </ListingTable>
          </ListingTable.Container>
        </Box>

        {room && (
          <Box>
            <Typography variant="h6">{`${room.name} on ${date}`}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              One-hour slots, 08:00 to 18:00, up to 30 days ahead.
            </Typography>
            <TextField
              label="Day"
              type="date"
              size="small"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today, max: lastDay } }}
              sx={{ mb: 2 }}
            />
            {outOfRange && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <AlertTitle>Day not bookable</AlertTitle>
                {`Choose a day from ${today} to ${lastDay}.`}
              </Alert>
            )}
            {bookings.status === "forbidden" && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Slot bookings are not available to your roles.
                  </Typography>
                </CardContent>
              </Card>
            )}
            <ListingTable.Container>
              <ListingTable>
                <ListingTable.Head>
                  <ListingTable.Row>
                    <ListingTable.Cell>Slot</ListingTable.Cell>
                    <ListingTable.Cell>Status</ListingTable.Cell>
                    <ListingTable.Cell>Booked by</ListingTable.Cell>
                    <ListingTable.Cell>Title</ListingTable.Cell>
                    <ListingTable.Cell />
                  </ListingTable.Row>
                </ListingTable.Head>
                <ListingTable.Body>
                  {slots.map(({ h, booking, past }) => (
                    <ListingTable.Row key={h}>
                      <ListingTable.Cell>{`${hourLabel(h)} to ${hourLabel(h + 1)}`}</ListingTable.Cell>
                      <ListingTable.Cell>
                        {bookings.status === "loading" && slotsKey ? (
                          <CircularProgress size={14} />
                        ) : booking ? (
                          <Chip size="small" label="Taken" color="warning" />
                        ) : past ? (
                          <Chip size="small" label="Past" variant="outlined" />
                        ) : (
                          <Chip size="small" label="Free" color="success" />
                        )}
                      </ListingTable.Cell>
                      <ListingTable.Cell>{booking?.bookedByName ?? ""}</ListingTable.Cell>
                      <ListingTable.Cell>{booking?.title ?? ""}</ListingTable.Cell>
                      <ListingTable.Cell align="right">
                        {booking && !past && bookings.status === "ready" && (
                          <Can op="POST /bookings/{bookingId}/cancel">
                            <Button size="small" variant="text" color="error" onClick={() => setCancelTarget(booking)}>
                              Cancel booking
                            </Button>
                          </Can>
                        )}
                        {!booking && !past && !outOfRange && bookings.status === "ready" && (
                          <Can op="POST /me/bookings">
                            <Button
                              size="small"
                              variant="text"
                              component={RouterLink}
                              to={`/book?room=${room.id}&date=${date}&start=${h}`}
                            >
                              Book
                            </Button>
                          </Can>
                        )}
                      </ListingTable.Cell>
                    </ListingTable.Row>
                  ))}
                </ListingTable.Body>
              </ListingTable>
            </ListingTable.Container>
          </Box>
        )}
      </Stack>

      <Dialog open={cancelTarget !== null} onClose={closeCancel} fullWidth maxWidth="sm">
        <DialogTitle>Cancel this booking</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {cancelFailed && (
              <Alert severity="error">
                <AlertTitle>Booking not cancelled</AlertTitle>
                The booking was not cancelled. Try again.
              </Alert>
            )}
            <Typography variant="body2">
              {cancelTarget
                ? `${cancelTarget.title || "Untitled"}, ${cancelTarget.bookedByName}, ${hourLabel(cancelTarget.startHour)} to ${hourLabel(cancelTarget.endHour)}. The slots become free.`
                : ""}
            </Typography>
            <TextField
              label="Reason (optional, shown to the booker)"
              multiline
              minRows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={closeCancel} disabled={cancelling}>
            Close
          </Button>
          <Button variant="contained" color="error" onClick={() => void confirmCancel()} disabled={cancelling}>
            Cancel booking
          </Button>
        </DialogActions>
      </Dialog>
    </PageContent>
  );
}
