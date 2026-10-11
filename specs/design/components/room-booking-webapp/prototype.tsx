import { useState, type ReactNode } from "react";
import {
  Alert, AppShell, Button, Dialog, EmptyState, Detail, Field, Form, Heading, Screen, Section, Stat,
  StatGroup, Table, Text, ValidationSummary, defineApp, useCollection, useDisplayState, useNav,
  useParams, useRole, useToday,
} from "@wso2/prototype-kit";

interface Room { id: string; name: string; capacity: number; location: string; status: string }
interface Booking {
  id: string; roomId: string; date: string; startHour: number; endHour: number; title: string;
  bookerId: string; bookerName: string; status: string; cancelledBy: string; cancelReason: string;
}

const NOW_HOUR = 11;
const LAST_DAY = "2026-02-14";
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const CURRENT_STAFF = "asha";

const rooms: Room[] = [
  { id: "r1", name: "Kandy", capacity: 8, location: "Floor 2, Main building", status: "Active" },
  { id: "r2", name: "Galle", capacity: 4, location: "Floor 2, Main building", status: "Active" },
  { id: "r3", name: "Sigiriya", capacity: 12, location: "Floor 3, Annex", status: "Active" },
  { id: "r4", name: "Ella", capacity: 6, location: "Floor 1, Annex", status: "Inactive" },
];

const bookings: Booking[] = [
  { id: "b1", roomId: "r1", date: "2026-01-15", startHour: 13, endHour: 15, title: "Sprint planning", bookerId: "asha", bookerName: "Asha Perera", status: "Active", cancelledBy: "", cancelReason: "" },
  { id: "b2", roomId: "r1", date: "2026-01-15", startHour: 9, endHour: 10, title: "Design sync", bookerId: "ravi", bookerName: "Ravi Silva", status: "Active", cancelledBy: "", cancelReason: "" },
  { id: "b3", roomId: "r2", date: "2026-01-16", startHour: 10, endHour: 11, title: "Interview", bookerId: "asha", bookerName: "Asha Perera", status: "Active", cancelledBy: "", cancelReason: "" },
  { id: "b4", roomId: "r3", date: "2026-01-16", startHour: 14, endHour: 16, title: "Town hall prep", bookerId: "asha", bookerName: "Asha Perera", status: "Cancelled", cancelledBy: "facilities", cancelReason: "Projector maintenance" },
  { id: "b5", roomId: "r3", date: "2026-01-17", startHour: 8, endHour: 9, title: "Vendor call", bookerId: "ravi", bookerName: "Ravi Silva", status: "Active", cancelledBy: "", cancelReason: "" },
];

const pad = (h: number) => (h < 10 ? `0${h}` : String(h));
const hourLabel = (h: number) => `${pad(h)}:00`;

function Shell({ children }: { children: ReactNode }) {
  const role = useRole();
  const admin = role === "FacilitiesAdmin";
  const user = admin
    ? { name: "Nimal Fernando", email: "nimal@acme.example" }
    : { name: "Asha Perera", email: "asha@acme.example" };
  const nav = admin
    ? [
        { id: "nav.availability", label: "Availability", to: "screen.availability" },
        { id: "nav.rooms", label: "Manage rooms", to: "screen.rooms" },
      ]
    : [
        { id: "nav.availability", label: "Availability", to: "screen.availability" },
        { id: "nav.book", label: "Book a room", to: "screen.book" },
        { id: "nav.my-bookings", label: "My bookings", to: "screen.my-bookings" },
      ];
  return (
    <AppShell id="shell" user={user} nav={nav} account="screen.account" signOut="screen.signed-out">
      {children}
    </AppShell>
  );
}

function Availability() {
  const role = useRole();
  const state = useDisplayState();
  const today = useToday();
  const params = useParams();
  const admin = role === "FacilitiesAdmin";
  const roomsData = useCollection<Room>("rooms");
  const bookingsData = useCollection<Booking>("bookings");
  const [roomId, setRoomId] = useState(params.room ?? "");
  const [date, setDate] = useState(params.date ?? today);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const visible = state === "state.empty" ? [] : roomsData.items.filter((r) => admin || r.status === "Active");
  const room = visible.find((r) => r.id === roomId) ?? visible[0];
  const outOfRange = date < today || date > LAST_DAY;
  const target = cancelId ? bookingsData.get(cancelId) : undefined;

  const slots = HOURS.map((h) => {
    const booking = room
      ? bookingsData.items.find(
          (b) => b.roomId === room.id && b.date === date && b.status === "Active" && b.startHour <= h && h < b.endHour,
        )
      : undefined;
    const past = date < today || (date === today && h < NOW_HOUR);
    return { h, booking, past };
  });

  return (
    <Shell>
      <Heading id="heading.availability" text="Rooms and availability" />
      {state === "state.failed" && (
        <Alert id="alert.failed" tone="error" title="Availability unavailable" text="We could not load bookings. Try again in a few minutes." />
      )}
      <Section id="section.rooms" title="Rooms" count={visible.length} subtitle="Pick a room to see its slots.">
        <Table
          id="table.rooms"
          columns={["Room", { label: "Capacity", kind: "number" }, "Location", { label: "Status", kind: "status" }]}
          onRowPress={(id) => setRoomId(id.replace("room.", ""))}
          rows={visible.map((r) => ({
            id: `room.${r.id}`,
            cells: [r.name, String(r.capacity), r.location],
            status: r.status === "Active" ? { text: "Active", tone: "success" as const } : { text: "Inactive", tone: "default" as const },
          }))}
          empty={<EmptyState id="empty.rooms" title="No rooms yet" text="Facilities will add rooms soon." />}
        />
      </Section>
      {room && (
        <Section
          id="section.slots"
          title={`${room.name} on ${date}`}
          subtitle="One-hour slots, 08:00 to 18:00, up to 30 days ahead."
        >
          <Field id="field.date" label="Day" type="date" value={date} onChange={setDate} />
          {outOfRange && (
            <Alert id="alert.range" tone="warning" title="Day not bookable" text={`Choose a day from ${today} to ${LAST_DAY}.`} />
          )}
          <Table
            id="table.slots"
            columns={["Slot", { label: "Status", kind: "status" }, "Booked by", "Title"]}
            rows={slots.map(({ h, booking, past }) => ({
              id: `slot.${h}`,
              cells: [`${hourLabel(h)} to ${hourLabel(h + 1)}`, booking ? booking.bookerName : "", booking ? booking.title : ""],
              status: booking
                ? { text: "Taken", tone: "warning" as const }
                : past
                  ? { text: "Past", tone: "default" as const }
                  : { text: "Free", tone: "success" as const },
              actions:
                !admin && !booking && !past && !outOfRange
                  ? [{ id: `slot.${h}.book`, label: "Book", to: "screen.book", params: { room: room.id, date, start: String(h) } }]
                  : admin && booking && !past
                    ? [{ id: `slot.${h}.cancel`, label: "Cancel booking", emphasis: "danger" as const, onPress: () => setCancelId(booking.id) }]
                    : [],
            }))}
          />
        </Section>
      )}
      <Dialog id="dialog.cancel" title="Cancel this booking" open={cancelId !== null} onClose={() => setCancelId(null)}>
        <Form
          id="form.cancel"
          onSubmit={(values) => {
            if (cancelId) {
              bookingsData.update(cancelId, { status: "Cancelled", cancelledBy: "facilities", cancelReason: values.reason ?? "" });
            }
            setCancelId(null);
          }}
          actions={<Button id="btn.cancel.confirm" label="Cancel booking" emphasis="danger" submit />}
        >
          <Text id="text.cancel" text={target ? `${target.title || "Untitled"}, ${target.bookerName}, ${hourLabel(target.startHour)} to ${hourLabel(target.endHour)}. The slots become free.` : ""} />
          <Field id="field.reason" name="reason" label="Reason (optional, shown to the booker)" type="textarea" />
        </Form>
      </Dialog>
    </Shell>
  );
}

function BookRoom() {
  const state = useDisplayState();
  const today = useToday();
  const params = useParams();
  const navigate = useNav();
  const roomsData = useCollection<Room>("rooms");
  const bookingsData = useCollection<Booking>("bookings");
  const [problem, setProblem] = useState<string | null>(null);
  const active = roomsData.items.filter((r) => r.status === "Active");
  const startOptions = HOURS.map(hourLabel);
  const endOptions = HOURS.map((h) => hourLabel(h + 1));
  const initialRoom = active.find((r) => r.id === params.room) ?? active[0];
  const start = params.start ? Number(params.start) : 9;

  const submit = (v: Record<string, string>) => {
    const chosen = active.find((r) => r.name === v.room);
    const date = v.date ?? today;
    const from = Number((v.start ?? "09:00").slice(0, 2));
    const to = Number((v.end ?? "10:00").slice(0, 2));
    if (!chosen) return setProblem("Choose a room.");
    if (date < today || date > LAST_DAY) return setProblem(`Choose a day from ${today} to ${LAST_DAY}.`);
    if (to <= from) return setProblem("The end time must be after the start time.");
    if (date === today && from < NOW_HOUR) return setProblem("That time has already passed today.");
    const clash = bookingsData.items.some(
      (b) => b.roomId === chosen.id && b.date === date && b.status === "Active" && b.startHour < to && from < b.endHour,
    );
    if (clash) return setProblem("One of those slots was just taken by someone else. Nothing was booked.");
    bookingsData.create({
      roomId: chosen.id, date, startHour: from, endHour: to, title: v.title ?? "", bookerId: CURRENT_STAFF,
      bookerName: "Asha Perera", status: "Active", cancelledBy: "", cancelReason: "",
    });
    setProblem(null);
    navigate.go("screen.my-bookings");
  };

  return (
    <Shell>
      <Heading id="heading.book" text="Book a room" />
      {state === "state.failed" && (
        <Alert id="alert.book-failed" tone="error" title="Booking not saved" text="The booking service did not answer. Nothing was booked; try again." />
      )}
      {problem && <Alert id="alert.problem" tone="error" title="Not booked" text={problem} />}
      {state === "state.validation-error" && (
        <ValidationSummary id="summary.book" issues={["Choose a room", "The end time must be after the start time"]} />
      )}
      <Form
        id="form.book"
        title="Pick a room and consecutive one-hour slots"
        onSubmit={submit}
        actions={<Button id="btn.book.confirm" label="Book room" emphasis="primary" submit />}
      >
        <Field id="field.room" name="room" label="Room" type="select" required options={active.map((r) => r.name)} defaultValue={initialRoom?.name} error={state === "state.validation-error" ? "Choose a room" : undefined} />
        <Field id="field.day" name="date" label="Day" type="date" required defaultValue={params.date ?? today} />
        <Field id="field.start" name="start" label="From" type="select" required options={startOptions} defaultValue={hourLabel(start)} />
        <Field id="field.end" name="end" label="Until" type="select" required options={endOptions} defaultValue={hourLabel(start + 1)} error={state === "state.validation-error" ? "End must be after start" : undefined} />
        <Field id="field.title" name="title" label="Title (optional)" type="text" placeholder="Sprint planning" />
      </Form>
    </Shell>
  );
}

function MyBookings() {
  const state = useDisplayState();
  const today = useToday();
  const roomsData = useCollection<Room>("rooms");
  const bookingsData = useCollection<Booking>("bookings");
  const mine = state === "state.empty"
    ? []
    : bookingsData.items
        .filter((b) => b.bookerId === CURRENT_STAFF && b.date >= today)
        .sort((a, b) => (a.date + pad(a.startHour)).localeCompare(b.date + pad(b.startHour)));
  const roomName = (id: string) => roomsData.get(id)?.name ?? "Room";
  return (
    <Shell>
      <Heading id="heading.my" text="My bookings" actions={<Button id="btn.new" label="Book a room" emphasis="primary" to="screen.book" />} />
      {state === "state.failed" && (
        <Alert id="alert.my-failed" tone="error" title="Bookings unavailable" text="We could not load your bookings. Try again in a few minutes." />
      )}
      <Section id="section.my" title="Upcoming" count={mine.length} subtitle="Cancelled bookings stay listed until their day has passed.">
        <Table
          id="table.my"
          columns={["Room", "Day", "Time", "Title", { label: "Status", kind: "status" }, "Note"]}
          rows={mine.map((b) => ({
            id: `booking.${b.id}`,
            cells: [
              roomName(b.roomId), b.date, `${hourLabel(b.startHour)} to ${hourLabel(b.endHour)}`, b.title || "Untitled",
              b.status === "Cancelled" ? `Cancelled by facilities${b.cancelReason ? `: ${b.cancelReason}` : ""}` : "",
            ],
            status: b.status === "Active" ? { text: "Booked", tone: "success" as const } : { text: "Cancelled", tone: "error" as const },
            actions: b.status === "Active"
              ? [{ id: `booking.${b.id}.cancel`, label: "Cancel", emphasis: "danger" as const, onPress: () => bookingsData.update(b.id, { status: "Cancelled", cancelledBy: "booker", cancelReason: "" }) }]
              : [],
          }))}
          empty={<EmptyState id="empty.my" title="No upcoming bookings" text="Book a room to see it here." actions={<Button id="btn.empty.book" label="Book a room" emphasis="primary" to="screen.book" />} />}
        />
      </Section>
    </Shell>
  );
}

function ManageRooms() {
  const state = useDisplayState();
  const today = useToday();
  const roomsData = useCollection<Room>("rooms");
  const bookingsData = useCollection<Booking>("bookings");
  const [editing, setEditing] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const list = state === "state.empty" ? [] : roomsData.items;
  const current = editing && editing !== "new" ? roomsData.get(editing) : undefined;
  const activeCount = list.filter((r) => r.status === "Active").length;

  const close = () => { setEditing(null); setProblem(null); };
  const save = (v: Record<string, string>) => {
    const name = (v.name ?? "").trim();
    const capacity = Number(v.capacity ?? "0");
    const location = (v.location ?? "").trim();
    if (!name || !location || !(capacity > 0)) return setProblem("Name, capacity and location are required.");
    if (roomsData.items.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== editing)) {
      return setProblem("A room with that name already exists.");
    }
    if (current) roomsData.update(current.id, { name, capacity, location });
    else roomsData.create({ name, capacity, location, status: "Active" });
    close();
  };
  const deactivate = (id: string) => {
    roomsData.update(id, { status: "Inactive" });
    bookingsData.items
      .filter((b) => b.roomId === id && b.status === "Active" && b.date >= today)
      .forEach((b) => bookingsData.update(b.id, { status: "Cancelled", cancelledBy: "facilities", cancelReason: "Room deactivated" }));
  };

  return (
    <Shell>
      <Heading id="heading.rooms" text="Manage rooms" />
      {state === "state.failed" && (
        <Alert id="alert.rooms-failed" tone="error" title="Rooms not saved" text="The change was not saved. Try again." />
      )}
      <StatGroup>
        <Stat id="stat.active" label="Active rooms" value={String(activeCount)} hint="open for booking" icon="Building2" tone="success" />
        <Stat id="stat.inactive" label="Inactive rooms" value={String(list.length - activeCount)} hint="hidden from staff" icon="CircleX" />
      </StatGroup>
      <Section
        id="section.rooms-admin"
        title="Rooms"
        count={list.length}
        subtitle="Deactivating a room cancels its future bookings."
        actions={<Button id="btn.add-room" label="Add room" emphasis="primary" onPress={() => setEditing("new")} />}
      >
        <Table
          id="table.rooms-admin"
          columns={["Room", { label: "Capacity", kind: "number" }, "Location", { label: "Status", kind: "status" }]}
          rows={list.map((r) => ({
            id: `room.${r.id}`,
            cells: [r.name, String(r.capacity), r.location],
            status: r.status === "Active" ? { text: "Active", tone: "success" as const } : { text: "Inactive", tone: "default" as const },
            actions: [
              { id: `room.${r.id}.edit`, label: "Edit", onPress: () => setEditing(r.id) },
              r.status === "Active"
                ? { id: `room.${r.id}.deactivate`, label: "Deactivate", emphasis: "danger" as const, onPress: () => deactivate(r.id) }
                : { id: `room.${r.id}.reactivate`, label: "Reactivate", onPress: () => roomsData.update(r.id, { status: "Active" }) },
            ],
          }))}
          empty={<EmptyState id="empty.rooms-admin" title="No rooms yet" text="Add the first meeting room." actions={<Button id="btn.empty.add" label="Add room" emphasis="primary" onPress={() => setEditing("new")} />} />}
        />
      </Section>
      <Dialog id="dialog.room" title={current ? `Edit ${current.name}` : "Add room"} open={editing !== null} onClose={close}>
        <Form
          id="form.room"
          key={editing ?? "none"}
          onSubmit={save}
          actions={<Button id="btn.room.save" label="Save room" emphasis="primary" submit />}
        >
          {problem && <Alert id="alert.room-problem" tone="error" title="Not saved" text={problem} />}
          <Field id="field.name" name="name" label="Name" required defaultValue={current?.name} error={state === "state.validation-error" ? "Give the room a name" : undefined} />
          <Field id="field.capacity" name="capacity" label="Capacity" type="number" required defaultValue={current ? String(current.capacity) : undefined} />
          <Field id="field.location" name="location" label="Location (floor/building)" required defaultValue={current?.location} />
        </Form>
      </Dialog>
    </Shell>
  );
}

function Account() {
  const role = useRole();
  const admin = role === "FacilitiesAdmin";
  return (
    <Shell>
      <Heading id="heading.account" text="Account" />
      <Detail
        id="detail.account"
        fields={[
          { label: "Name", value: admin ? "Nimal Fernando" : "Asha Perera" },
          { label: "Email", value: admin ? "nimal@acme.example" : "asha@acme.example" },
          { label: "Role", value: admin ? "Facilities admin" : "Staff" },
        ]}
      />
    </Shell>
  );
}

function SignedOut() {
  return (
    <Screen>
      <Heading id="heading.signed-out" text="You are signed out" />
      <Button id="btn.sign-in" label="Sign in" emphasis="primary" to="screen.availability" />
    </Screen>
  );
}

export default defineApp({
  screens: {
    "screen.availability": Availability,
    "screen.book": BookRoom,
    "screen.my-bookings": MyBookings,
    "screen.rooms": ManageRooms,
    "screen.account": Account,
    "screen.signed-out": SignedOut,
  },
  data: { rooms, bookings },
});
