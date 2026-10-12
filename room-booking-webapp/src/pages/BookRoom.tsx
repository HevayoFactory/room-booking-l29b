import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Form,
  MenuItem,
  PageContent,
  PageTitle,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { roomBookingApi } from "../api";
import { ForbiddenError } from "../authz/client";
import type { components } from "../generated/room-booking-api";

type Room = components["schemas"]["Room"];

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const DAYS_AHEAD = 30;
const DELAYED_MS = 3000;

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
const hourLabel = (h: number): string => `${pad(h)}:00`;
const isoDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type Problem = { kind: "conflict" | "invalid" | "failed"; text: string };

export function BookRoomPage(): ReactElement {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const now = new Date();
  const today = isoDay(now);
  const lastDay = isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS_AHEAD));

  const startParam = Number(params.get("start"));
  const initialStart = HOURS.includes(startParam) ? startParam : 9;

  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [roomsState, setRoomsState] = useState<"loading" | "ready" | "forbidden" | "failed">("loading");
  const [roomId, setRoomId] = useState(params.get("room") ?? "");
  const [date, setDate] = useState(params.get("date") ?? today);
  const [from, setFrom] = useState(initialStart);
  const [until, setUntil] = useState(initialStart + 1);
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    let live = true;
    roomBookingApi.GET("/rooms", { params: { query: { limit: 100 } } }).then(
      (res) => {
        if (!live) return;
        if (!res.data) return setRoomsState("failed");
        const active = res.data.data.filter((r) => r.active);
        setRooms(active);
        setRoomId((current) => (active.some((r) => r.id === current) ? current : (active[0]?.id ?? "")));
        setRoomsState("ready");
      },
      (err: unknown) => live && setRoomsState(err instanceof ForbiddenError ? "forbidden" : "failed"),
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!submitting) {
      setDelayed(false);
      return;
    }
    const t = setTimeout(() => setDelayed(true), DELAYED_MS);
    return () => clearTimeout(t);
  }, [submitting]);

  const validate = (): string[] => {
    const found: string[] = [];
    if (!roomId) found.push("Choose a room");
    if (!date || date < today || date > lastDay) found.push(`Choose a day from ${today} to ${lastDay}`);
    if (until <= from) found.push("The end time must be after the start time");
    if (date === today && from < now.getHours()) found.push("That time has already passed today");
    return found;
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setProblem(null);
    const found = validate();
    setIssues(found);
    if (found.length > 0) return;
    setSubmitting(true);
    try {
      const res = await roomBookingApi.POST("/me/bookings", {
        body: { roomId, date, startHour: from, endHour: until, title: title.trim() || null },
      });
      if (res.response.status === 409) {
        setProblem({
          kind: "conflict",
          text: "One of those slots was just taken by someone else. Nothing was booked.",
        });
      } else if (res.response.status === 400 || res.response.status === 404) {
        setProblem({
          kind: "invalid",
          text: res.error?.description ?? res.error?.message ?? "The booking was not accepted. Nothing was booked.",
        });
      } else if (!res.data) {
        setProblem({ kind: "failed", text: "The booking service did not answer. Nothing was booked; try again." });
      } else {
        navigate("/my-bookings");
      }
    } catch (err) {
      if (err instanceof ForbiddenError) throw err;
      setProblem({ kind: "failed", text: "The booking service did not answer. Nothing was booked; try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Book a room</PageTitle.Header>
      </PageTitle>

      {problem?.kind === "failed" && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Booking not saved</AlertTitle>
          {problem.text}
        </Alert>
      )}
      {(problem?.kind === "conflict" || problem?.kind === "invalid") && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Not booked</AlertTitle>
          {problem.text}
        </Alert>
      )}
      {roomsState === "failed" && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Rooms unavailable</AlertTitle>
          We could not load the rooms. Try again in a few minutes.
        </Alert>
      )}
      {roomsState === "forbidden" && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your roles do not include viewing rooms, so a room cannot be chosen.
        </Alert>
      )}
      {delayed && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This is taking longer than usual. Hang on.
        </Alert>
      )}
      {issues.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Fix these and try again</AlertTitle>
          {issues.map((issue) => (
            <Typography key={issue} variant="body2">
              {issue}
            </Typography>
          ))}
        </Alert>
      )}

      <Card variant="outlined">
        <CardContent>
          {roomsState === "loading" ? (
            <CircularProgress size={20} />
          ) : (
            <Box component="form" onSubmit={submit} noValidate>
              <Form.Section>
                <Form.Header>Pick a room and consecutive one-hour slots</Form.Header>
                <Form.Stack>
                  <TextField
                    select
                    required
                    label="Room"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    error={issues.includes("Choose a room")}
                    helperText={issues.includes("Choose a room") ? "Choose a room" : undefined}
                  >
                    {(rooms ?? []).map((r) => (
                      <MenuItem key={r.id} value={r.id}>
                        {r.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    required
                    label="Day"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today, max: lastDay } }}
                  />
                  <TextField
                    select
                    required
                    label="From"
                    value={from}
                    onChange={(e) => setFrom(Number(e.target.value))}
                  >
                    {HOURS.map((h) => (
                      <MenuItem key={h} value={h}>
                        {hourLabel(h)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    required
                    label="Until"
                    value={until}
                    onChange={(e) => setUntil(Number(e.target.value))}
                    error={until <= from && issues.length > 0}
                    helperText={until <= from && issues.length > 0 ? "End must be after start" : undefined}
                  >
                    {HOURS.map((h) => (
                      <MenuItem key={h + 1} value={h + 1}>
                        {hourLabel(h + 1)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Title (optional)"
                    placeholder="Sprint planning"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </Form.Stack>
              </Form.Section>
              <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 2 }}>
                <Button type="submit" variant="contained" disabled={submitting || roomsState !== "ready"}>
                  Book room
                </Button>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </PageContent>
  );
}
