import { useCallback, useEffect, useState, type ReactElement } from "react";
import {
  Alert,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  ListingTable,
  PageContent,
  PageTitle,
  Stack,
  TextField,
  Typography,
  Box,
} from "@wso2/oxygen-ui";
import { Building2, CircleX } from "@wso2/oxygen-ui-icons-react";
import { roomBookingApi } from "../api";
import { ForbiddenError } from "../authz/client";
import { Can } from "../authz/gates";
import type { components } from "../generated/room-booking-api";

type Room = components["schemas"]["Room"];

const PAGE_LIMIT = 100;
const DELAYED_MS = 3000;

/** `null` = closed, "new" = add, otherwise the id of the room being edited. */
type Editing = string | null;

export function ManageRoomsPage(): ReactElement {
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "failed">("loading");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [delayed, setDelayed] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [location, setLocation] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await roomBookingApi.GET("/admin/rooms", { params: { query: { limit: PAGE_LIMIT } } });
      if (!res.data) return setState("failed");
      setRooms(res.data.data);
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

  const current = editing && editing !== "new" ? rooms.find((r) => r.id === editing) : undefined;
  const activeCount = rooms.filter((r) => r.active).length;

  const open = (target: Editing): void => {
    const room = target && target !== "new" ? rooms.find((r) => r.id === target) : undefined;
    setName(room?.name ?? "");
    setCapacity(room ? String(room.capacity) : "");
    setLocation(room?.location ?? "");
    setIssues([]);
    setEditing(target);
  };
  const close = (): void => {
    if (!saving) setEditing(null);
  };

  const save = async (): Promise<void> => {
    const problems: string[] = [];
    const trimmedName = name.trim();
    const trimmedLocation = location.trim();
    const cap = Number(capacity);
    if (!trimmedName) problems.push("Give the room a name");
    if (!Number.isInteger(cap) || cap < 1) problems.push("Capacity must be a whole number of at least 1");
    if (!trimmedLocation) problems.push("Give the room a location");
    setIssues(problems);
    if (problems.length > 0) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      const body = { name: trimmedName, capacity: cap, location: trimmedLocation };
      const res = current
        ? await roomBookingApi.PATCH("/admin/rooms/{roomId}", {
            params: { path: { roomId: current.id } },
            body,
          })
        : await roomBookingApi.POST("/admin/rooms", { body });
      if (res.response.status === 409) {
        setIssues(["A room with that name already exists."]);
      } else if (res.response.status === 400) {
        setIssues([res.error?.message ?? "The room was not accepted."]);
      } else if (!res.response.ok) {
        setEditing(null);
        setSaveFailed(true);
      } else {
        setEditing(null);
        await load();
      }
    } catch (err) {
      if (err instanceof ForbiddenError) return;
      setEditing(null);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (room: Room, active: boolean): Promise<void> => {
    setBusyId(room.id);
    setSaveFailed(false);
    try {
      const res = await roomBookingApi.PATCH("/admin/rooms/{roomId}", {
        params: { path: { roomId: room.id } },
        body: { active },
      });
      if (!res.response.ok) setSaveFailed(true);
      else await load();
    } catch (err) {
      if (!(err instanceof ForbiddenError)) setSaveFailed(true);
    } finally {
      setBusyId(null);
    }
  };

  const addButton = (
    <Can op="POST /admin/rooms">
      <Button variant="contained" onClick={() => open("new")}>
        Add room
      </Button>
    </Can>
  );

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Manage rooms</PageTitle.Header>
      </PageTitle>

      {saveFailed && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveFailed(false)}>
          <AlertTitle>Rooms not saved</AlertTitle>
          The change was not saved. Try again.
        </Alert>
      )}
      {state === "failed" && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Rooms unavailable</AlertTitle>
          We could not load rooms. Try again in a few minutes.
        </Alert>
      )}
      {delayed && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This is taking longer than usual. Hang on.
        </Alert>
      )}

      <Stack spacing={3}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <StatTile label="Active rooms" value={activeCount} hint="open for booking" icon={<Building2 size={18} />} color="success.main" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <StatTile label="Inactive rooms" value={rooms.length - activeCount} hint="hidden from staff" icon={<CircleX size={18} />} color="text.secondary" />
          </Grid>
        </Grid>

        <Box>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6">Rooms</Typography>
              {state === "ready" && <Chip size="small" label={rooms.length} />}
            </Stack>
            {addButton}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Deactivating a room cancels its future bookings.
          </Typography>
          <ListingTable.Container>
            <ListingTable>
              <ListingTable.Head>
                <ListingTable.Row>
                  <ListingTable.Cell>Room</ListingTable.Cell>
                  <ListingTable.Cell align="right">Capacity</ListingTable.Cell>
                  <ListingTable.Cell>Location</ListingTable.Cell>
                  <ListingTable.Cell>Status</ListingTable.Cell>
                  <ListingTable.Cell />
                </ListingTable.Row>
              </ListingTable.Head>
              <ListingTable.Body>
                {state === "loading" && (
                  <ListingTable.Row>
                    <ListingTable.Cell colSpan={5} align="center">
                      <CircularProgress size={20} />
                    </ListingTable.Cell>
                  </ListingTable.Row>
                )}
                {state === "forbidden" && (
                  <ListingTable.Row>
                    <ListingTable.Cell colSpan={5}>
                      <ListingTable.EmptyState
                        title="Not available to you"
                        description="Your roles do not include managing rooms."
                      />
                    </ListingTable.Cell>
                  </ListingTable.Row>
                )}
                {state === "ready" && rooms.length === 0 && (
                  <ListingTable.Row>
                    <ListingTable.Cell colSpan={5}>
                      <ListingTable.EmptyState
                        title="No rooms yet"
                        description="Add the first meeting room."
                        action={addButton}
                      />
                    </ListingTable.Cell>
                  </ListingTable.Row>
                )}
                {rooms.map((r) => (
                  <ListingTable.Row key={r.id}>
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
                    <ListingTable.Cell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Can op="PATCH /admin/rooms/{roomId}">
                          <Button size="small" variant="text" disabled={busyId === r.id} onClick={() => open(r.id)}>
                            Edit
                          </Button>
                          {r.active ? (
                            <Button
                              size="small"
                              variant="text"
                              color="error"
                              disabled={busyId === r.id}
                              onClick={() => void setActive(r, false)}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button size="small" variant="text" disabled={busyId === r.id} onClick={() => void setActive(r, true)}>
                              Reactivate
                            </Button>
                          )}
                        </Can>
                      </Stack>
                    </ListingTable.Cell>
                  </ListingTable.Row>
                ))}
              </ListingTable.Body>
            </ListingTable>
          </ListingTable.Container>
        </Box>
      </Stack>

      <Dialog open={editing !== null} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>{current ? `Edit ${current.name}` : "Add room"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {issues.length > 0 && (
              <Alert severity="error">
                <AlertTitle>Not saved</AlertTitle>
                {issues.map((i) => (
                  <Typography key={i} variant="body2">
                    {i}
                  </Typography>
                ))}
              </Alert>
            )}
            <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <TextField
              label="Capacity"
              type="number"
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              slotProps={{ htmlInput: { min: 1 } }}
            />
            <TextField
              label="Location (floor/building)"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={close} disabled={saving}>
            Close
          </Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving}>
            Save room
          </Button>
        </DialogActions>
      </Dialog>
    </PageContent>
  );
}

function StatTile(props: {
  label: string;
  value: number;
  hint: string;
  icon: ReactElement;
  color: string;
}): ReactElement {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: props.color }}>
          {props.icon}
          <Typography variant="overline">{props.label}</Typography>
        </Stack>
        <Typography variant="h4">{props.value}</Typography>
        <Typography variant="caption" color="text.secondary">
          {props.hint}
        </Typography>
      </CardContent>
    </Card>
  );
}
