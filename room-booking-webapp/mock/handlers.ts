import { http, HttpResponse, type RequestHandler } from "msw";

// One handler per operation of room-booking-api's openapi.yaml (paths carry the
// `/api` prefix, most specific first), seeded from the records in prototype.tsx.
// State lives in module scope: a full page load resets it to the seed data.
//
// The caller this mock speaks for, shaped like the gateway assertion. Handlers
// under `/api/me/…` resolve rows through it, never through a query parameter.
export const mockCaller = {
  userId: "01a0ab00-0000-7000-8000-000000000001",
  username: "mock-staff",
};

interface MockRoom { id: string; name: string; capacity: number; location: string; active: boolean }
interface MockBooking {
  id: string; roomId: string; roomName: string; date: string; startHour: number; endHour: number;
  title: string | null; bookedByName: string; status: "active" | "cancelled";
  cancelledBy: "booker" | "facilities" | null; cancelReason: string | null;
}

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
/** The day `offset` days from today, as the prototype's "today" is the first seed day. */
function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const rooms: MockRoom[] = [
  { id: "r1", name: "Kandy", capacity: 8, location: "Floor 2, Main building", active: true },
  { id: "r2", name: "Galle", capacity: 4, location: "Floor 2, Main building", active: true },
  { id: "r3", name: "Sigiriya", capacity: 12, location: "Floor 3, Annex", active: true },
  { id: "r4", name: "Ella", capacity: 6, location: "Floor 1, Annex", active: false },
];

const roomName = (id: string): string => rooms.find((r) => r.id === id)?.name ?? "";
const seed = (
  id: string, roomId: string, offset: number, startHour: number, endHour: number, title: string,
  bookedByName: string, cancelled?: { by: "facilities"; reason: string },
): MockBooking => ({
  id, roomId, roomName: roomName(roomId), date: day(offset), startHour, endHour, title, bookedByName,
  status: cancelled ? "cancelled" : "active",
  cancelledBy: cancelled ? cancelled.by : null,
  cancelReason: cancelled ? cancelled.reason : null,
});

const bookings: MockBooking[] = [
  seed("b1", "r1", 0, 13, 15, "Sprint planning", "Asha Perera"),
  seed("b2", "r1", 0, 9, 10, "Design sync", "Ravi Silva"),
  seed("b3", "r2", 1, 10, 11, "Interview", "Asha Perera"),
  seed("b4", "r3", 1, 14, 16, "Town hall prep", "Asha Perera", { by: "facilities", reason: "Projector maintenance" }),
  seed("b5", "r3", 2, 8, 9, "Vendor call", "Ravi Silva"),
];

const callerName = "Asha Perera";
let nextId = 100;

function page<T>(request: Request, rows: T[]) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20) || 20, 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
  return { count: rows.length, next: null, previous: null, data: rows.slice(offset, offset + limit) };
}

const badRequest = (message: string) => HttpResponse.json({ code: 400, message }, { status: 400 });

export const handlers: RequestHandler[] = [
  // GET /rooms — active rooms
  http.get("/api/rooms", ({ request }) => HttpResponse.json(page(request, rooms.filter((r) => r.active)))),

  // GET /admin/rooms — every room, inactive included
  http.get("/api/admin/rooms", ({ request }) => HttpResponse.json(page(request, rooms))),

  // GET /bookings — active bookings of a room on a day, with who booked them
  http.get("/api/bookings", ({ request }) => {
    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId");
    const date = url.searchParams.get("date");
    if (!roomId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("roomId and date are required");
    const rows = bookings
      .filter((b) => b.roomId === roomId && b.date === date && b.status === "active")
      .sort((a, b) => a.startHour - b.startHour);
    return HttpResponse.json(page(request, rows));
  }),

  // GET /me/bookings — the caller's upcoming bookings, facilities-cancelled ones included
  http.get("/api/me/bookings", ({ request }) => {
    const today = day(0);
    const rows = bookings
      .filter((b) => b.bookedByName === callerName && b.date >= today && (b.status === "active" || b.cancelledBy === "facilities"))
      .sort((a, b) => (a.date + pad(a.startHour)).localeCompare(b.date + pad(b.startHour)));
    return HttpResponse.json(page(request, rows));
  }),

  // POST /me/bookings — 409 when any slot is taken; the title "Conflict" books nothing
  http.post("/api/me/bookings", async ({ request }) => {
    const body = (await request.json().catch(() => null)) as {
      roomId?: string; date?: string; startHour?: number; endHour?: number; title?: string | null;
    } | null;
    if (!body || !body.roomId || !body.date || !Number.isInteger(body.startHour) || !Number.isInteger(body.endHour)) {
      return badRequest("roomId, date, startHour and endHour are required");
    }
    const { roomId, date } = body;
    const start = body.startHour as number;
    const end = body.endHour as number;
    const room = rooms.find((r) => r.id === roomId && r.active);
    if (!room) return HttpResponse.json({ code: 404, message: "No such room" }, { status: 404 });
    if (start < 8 || end > 18 || end <= start) return badRequest("Slots run 08:00 to 18:00 and end after they start");
    if (date < day(0) || date > day(30)) return badRequest("date must be today up to 30 days ahead");
    if (date === day(0) && start < new Date().getHours()) return badRequest("That time has already passed today");
    const clash = bookings.some(
      (b) => b.roomId === roomId && b.date === date && b.status === "active" && b.startHour < end && start < b.endHour,
    );
    if (clash) {
      return HttpResponse.json(
        { code: 409, message: "Slot taken", description: "One of those slots was just taken by someone else." },
        { status: 409 },
      );
    }
    const created: MockBooking = {
      id: `b${nextId++}`, roomId, roomName: room.name, date, startHour: start, endHour: end,
      title: body.title?.trim() || null, bookedByName: callerName, status: "active", cancelledBy: null, cancelReason: null,
    };
    bookings.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  // POST /me/bookings/{bookingId}/cancel — own, upcoming, active bookings only; otherwise 404
  http.post("/api/me/bookings/:bookingId/cancel", ({ params }) => {
    const b = bookings.find((x) => x.id === params.bookingId);
    const upcoming = b && (b.date > day(0) || (b.date === day(0) && b.endHour > new Date().getHours()));
    if (!b || b.bookedByName !== callerName || b.status !== "active" || !upcoming) {
      return HttpResponse.json({ code: 404, message: "No such booking" }, { status: 404 });
    }
    b.status = "cancelled";
    b.cancelledBy = "booker";
    b.cancelReason = null;
    return HttpResponse.json(b);
  }),
];
