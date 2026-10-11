import { http, HttpResponse } from "msw";
import type { components } from "../src/generated/room-booking-api";

// State lives in module scope, i.e. in the PAGE: a full page load (reload, typed URL)
// re-runs this module and restores the seed data. Only in-app navigation carries a change
// forward. That makes a verification run repeatable, and is also why a row created a
// moment ago vanishes if a run leaves the app mid-scenario.

type Room = components["schemas"]["Room"];
type Booking = components["schemas"]["Booking"];

// The caller this mock speaks for (the prototype's Asha). `/me/…` resolves through it.
export const mockCaller = { id: "asha", name: "Asha Perera" };

interface StoredBooking extends Booking {
  bookerId: string;
}

const pad = (n: number): string => String(n).padStart(2, "0");
function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let rooms: Room[] = [
  { id: "r1", name: "Kandy", capacity: 8, location: "Floor 2, Main building", active: true },
  { id: "r2", name: "Galle", capacity: 4, location: "Floor 2, Main building", active: true },
  { id: "r3", name: "Sigiriya", capacity: 12, location: "Floor 3, Annex", active: true },
  { id: "r4", name: "Ella", capacity: 6, location: "Floor 1, Annex", active: false },
];

function seedBooking(
  id: string, roomId: string, days: number, startHour: number, endHour: number, title: string,
  bookerId: string, bookedByName: string, cancelled?: { by: "booker" | "facilities"; reason: string },
): StoredBooking {
  return {
    id, roomId, roomName: rooms.find((r) => r.id === roomId)?.name ?? "", date: dayOffset(days),
    startHour, endHour, title, bookerId, bookedByName,
    status: cancelled ? "cancelled" : "active",
    cancelledBy: cancelled?.by ?? null, cancelReason: cancelled?.reason ?? null,
  };
}

let bookings: StoredBooking[] = [
  seedBooking("b1", "r1", 1, 13, 15, "Sprint planning", "asha", "Asha Perera"),
  seedBooking("b2", "r1", 1, 9, 10, "Design sync", "ravi", "Ravi Silva"),
  seedBooking("b3", "r2", 2, 10, 11, "Interview", "asha", "Asha Perera"),
  seedBooking("b4", "r3", 2, 14, 16, "Town hall prep", "asha", "Asha Perera", { by: "facilities", reason: "Projector maintenance" }),
  seedBooking("b5", "r3", 3, 8, 9, "Vendor call", "ravi", "Ravi Silva"),
];
let nextId = 100;

const publicBooking = ({ bookerId: _b, ...rest }: StoredBooking): Booking => rest;
const error = (status: number, message: string) =>
  HttpResponse.json({ code: status, message }, { status });
const page = <T,>(data: T[]) => ({ count: data.length, next: null, previous: null, data });

function cancelRow(b: StoredBooking, by: "booker" | "facilities", reason: string | null): void {
  b.status = "cancelled";
  b.cancelledBy = by;
  b.cancelReason = reason;
}

export const handlers = [
  http.get("/api/rooms", () => HttpResponse.json(page(rooms.filter((r) => r.active)))),

  http.get("/api/admin/rooms", () => HttpResponse.json(page(rooms))),

  http.post("/api/admin/rooms", async ({ request }) => {
    const input = (await request.json()) as { name?: string; capacity?: number; location?: string };
    if (!input.name?.trim() || !input.location?.trim() || !(Number(input.capacity) >= 1)) {
      return error(400, "name, capacity and location are required");
    }
    if (rooms.some((r) => r.name.toLowerCase() === input.name!.trim().toLowerCase())) {
      return error(409, "a room with that name already exists");
    }
    const created: Room = {
      id: `r${nextId++}`, name: input.name.trim(), capacity: Number(input.capacity),
      location: input.location.trim(), active: true,
    };
    rooms = [...rooms, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch("/api/admin/rooms/:roomId", async ({ params, request }) => {
    const room = rooms.find((r) => r.id === params.roomId);
    if (!room) return error(404, "room not found");
    const patch = (await request.json()) as Partial<Room>;
    if (patch.name !== undefined && rooms.some((r) => r.id !== room.id && r.name.toLowerCase() === patch.name!.trim().toLowerCase())) {
      return error(409, "a room with that name already exists");
    }
    if (patch.capacity !== undefined && !(patch.capacity >= 1)) return error(400, "capacity must be at least 1");
    Object.assign(room, {
      ...(patch.name !== undefined && { name: patch.name.trim() }),
      ...(patch.capacity !== undefined && { capacity: patch.capacity }),
      ...(patch.location !== undefined && { location: patch.location.trim() }),
    });
    if (patch.active === false && room.active) {
      room.active = false;
      const today = dayOffset(0);
      bookings.filter((b) => b.roomId === room.id && b.status === "active" && b.date >= today)
        .forEach((b) => cancelRow(b, "facilities", "Room deactivated"));
    } else if (patch.active === true) {
      room.active = true;
    }
    bookings.forEach((b) => { if (b.roomId === room.id) b.roomName = room.name; });
    return HttpResponse.json(room);
  }),

  http.get("/api/bookings", ({ request }) => {
    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId");
    const date = url.searchParams.get("date");
    if (!roomId || !date) return error(400, "roomId and date are required");
    return HttpResponse.json(
      page(bookings.filter((b) => b.roomId === roomId && b.date === date && b.status === "active").map(publicBooking)),
    );
  }),

  http.post("/api/bookings/:bookingId/cancel", async ({ params, request }) => {
    const row = bookings.find((b) => b.id === params.bookingId && b.status === "active");
    if (!row) return error(404, "booking not found");
    const input = (await request.json().catch(() => ({}))) as { reason?: string | null };
    cancelRow(row, "facilities", input.reason?.trim() || null);
    return HttpResponse.json(publicBooking(row));
  }),

  // The caller's own rows: the path says so.
  http.get("/api/me/bookings", () =>
    HttpResponse.json(
      page(
        bookings
          .filter((b) => b.bookerId === mockCaller.id && b.date >= dayOffset(0))
          .sort((a, b) => (a.date + pad(a.startHour)).localeCompare(b.date + pad(b.startHour)))
          .map(publicBooking),
      ),
    ),
  ),

  http.post("/api/me/bookings", async ({ request }) => {
    const input = (await request.json()) as {
      roomId?: string; date?: string; startHour?: number; endHour?: number; title?: string | null;
    };
    const room = rooms.find((r) => r.id === input.roomId && r.active);
    if (!room) return error(404, "room not found");
    const { date, startHour, endHour } = input;
    if (!date || startHour === undefined || endHour === undefined) return error(400, "date, startHour and endHour are required");
    if (startHour < 8 || endHour > 18 || endHour <= startHour) return error(400, "slots must be within 08:00 to 18:00 and end after they start");
    if (date < dayOffset(0) || date > dayOffset(30)) return error(400, "day must be today up to 30 days ahead");
    if (date === dayOffset(0) && startHour <= new Date().getHours() - 1) return error(400, "that time has already passed");
    const clash = bookings.some((b) => b.roomId === room.id && b.date === date && b.status === "active" && b.startHour < endHour && startHour < b.endHour);
    if (clash) return error(409, "one of those slots is already taken");
    const created: StoredBooking = {
      id: `b${nextId++}`, roomId: room.id, roomName: room.name, date, startHour, endHour,
      title: input.title ?? null, bookerId: mockCaller.id, bookedByName: mockCaller.name,
      status: "active", cancelledBy: null, cancelReason: null,
    };
    bookings = [...bookings, created];
    return HttpResponse.json(publicBooking(created), { status: 201 });
  }),

  http.post("/api/me/bookings/:bookingId/cancel", ({ params }) => {
    const row = bookings.find((b) => b.id === params.bookingId && b.bookerId === mockCaller.id && b.status === "active");
    if (!row) return error(404, "booking not found");
    cancelRow(row, "booker", null);
    return HttpResponse.json(publicBooking(row));
  }),
];
