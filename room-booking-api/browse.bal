import ballerina/http;
import ballerina/log;
import ballerina/sql;
import ballerina/time;
import ballerinax/postgresql;

const int DEFAULT_LIMIT = 20;
const int MAX_LIMIT = 100;

type RoomRow record {|
    string id;
    string name;
    int capacity;
    string location;
    boolean active;
|};

type BookingRow record {|
    string id;
    @sql:Column {name: "room_id"}
    string roomId;
    @sql:Column {name: "room_name"}
    string roomName;
    string date;
    @sql:Column {name: "start_hour"}
    int startHour;
    @sql:Column {name: "end_hour"}
    int endHour;
    string? title;
    @sql:Column {name: "booked_by_name"}
    string bookedByName;
    string status;
    @sql:Column {name: "cancelled_by"}
    string? cancelledBy;
    @sql:Column {name: "cancel_reason"}
    string? cancelReason;
|};

# Clamps paging input into the contract's range (limit 1..100, offset >= 0).
#
# + 'limit - requested page size
# + offset - requested offset
# + return - the page size and offset to use
function normalizePaging(int 'limit, int offset) returns [int, int] {
    int size = 'limit < 1 ? DEFAULT_LIMIT : ('limit > MAX_LIMIT ? MAX_LIMIT : 'limit);
    return [size, offset < 0 ? 0 : offset];
}

# Relative URI of a neighbouring page, or () when there is none.
#
# + path - the collection path
# + extra - extra query text such as "&roomId=r1", or ""
# + 'limit - page size
# + offset - offset of the page to link
# + valid - whether that page exists
# + return - the relative URI or ()
function pageLink(string path, string extra, int 'limit, int offset, boolean valid) returns string? {
    if !valid {
        return ();
    }
    return string `${path}?limit=${'limit}&offset=${offset}${extra}`;
}

function toRoom(RoomRow row) returns Room => {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    location: row.location,
    active: row.active
};

function toBooking(BookingRow row) returns Booking {
    Booking booking = {
        id: row.id,
        roomId: row.roomId,
        roomName: row.roomName,
        date: row.date,
        startHour: row.startHour,
        endHour: row.endHour,
        bookedByName: row.bookedByName,
        status: row.status == "cancelled" ? "cancelled" : "active"
    };
    string? title = row.title;
    if title is string {
        booking.title = title;
    }
    string? cancelledBy = row.cancelledBy;
    if cancelledBy == "booker" || cancelledBy == "facilities" {
        booking.cancelledBy = cancelledBy;
    }
    string? reason = row.cancelReason;
    if reason is string {
        booking.cancelReason = reason;
    }
    return booking;
}

function roomPage(Room[] rooms, int total, string path, int 'limit, int offset) returns RoomList {
    return {
        count: total,
        next: pageLink(path, "", 'limit, offset + 'limit, offset + 'limit < total),
        previous: pageLink(path, "", 'limit, offset - 'limit < 0 ? 0 : offset - 'limit, offset > 0),
        data: rooms
    };
}

# One page of rooms, ordered by name.
#
# + includeInactive - true for the admin view
# + 'limit - page size
# + offset - offset
# + return - the page, or an error
function loadRooms(boolean includeInactive, int 'limit, int offset) returns RoomList|error {
    postgresql:Client db = check getDb();
    sql:ParameterizedQuery filter = includeInactive ? ` TRUE` : ` active`;
    sql:ParameterizedQuery countQuery = sql:queryConcat(`SELECT count(*) FROM rooms WHERE`, filter);
    int total = check db->queryRow(countQuery);
    sql:ParameterizedQuery listQuery = sql:queryConcat(
        `SELECT id, name, capacity, location, active FROM rooms WHERE`, filter,
        ` ORDER BY lower(name), id LIMIT ${'limit} OFFSET ${offset}`);
    stream<RoomRow, sql:Error?> rows = db->query(listQuery);
    Room[] rooms = check from RoomRow row in rows
        select toRoom(row);
    string path = includeInactive ? "/admin/rooms" : "/rooms";
    return roomPage(rooms, total, path, 'limit, offset);
}

# Active bookings of one room on one day, soonest first. The booker name is the
# bookedByName stored on the booking when it was made.
#
# + roomId - the room
# + date - YYYY-MM-DD
# + 'limit - page size
# + offset - offset
# + return - the page, or an error
function loadDayBookings(string roomId, string date, int 'limit, int offset) returns BookingList|error {
    postgresql:Client db = check getDb();
    int total = check db->queryRow(`SELECT count(*) FROM bookings
        WHERE room_id = ${roomId} AND booking_date = ${date}::date AND status = 'active'`);
    stream<BookingRow, sql:Error?> rows = db->query(`SELECT b.id, b.room_id, r.name AS room_name,
        b.booking_date::text AS date, b.start_hour, b.end_hour, b.title, b.booked_by_name,
        b.status, b.cancelled_by, b.cancel_reason
        FROM bookings b JOIN rooms r ON r.id = b.room_id
        WHERE b.room_id = ${roomId} AND b.booking_date = ${date}::date AND b.status = 'active'
        ORDER BY b.start_hour, b.id LIMIT ${'limit} OFFSET ${offset}`);
    Booking[] bookings = check from BookingRow row in rows
        select toBooking(row);
    string extra = string `&roomId=${roomId}&date=${date}`;
    return {
        count: total,
        next: pageLink("/bookings", extra, 'limit, offset + 'limit, offset + 'limit < total),
        previous: pageLink("/bookings", extra, 'limit, offset - 'limit < 0 ? 0 : offset - 'limit, offset > 0),
        data: bookings
    };
}

function unauthorized() returns ErrorUnauthorized {
    return {body: {code: 401, message: "Unauthorized", description: "no verified caller on this request"}};
}

function badRequest(string description) returns ErrorBadRequest {
    return {body: {code: 400, message: "Bad Request", description}};
}

function serverError(string operation, error cause) returns http:InternalServerError {
    log:printError("request failed", operation = operation, 'error = cause);
    return http:INTERNAL_SERVER_ERROR;
}

# Request-level checks of GET /bookings: a room id, and a date in the bookable window.
#
# + roomId - the room query value
# + date - the date query value
# + now - current civil time in the office zone
# + return - a message when invalid, () when valid
function validateDayQuery(string roomId, string date, time:Civil now) returns string? {
    if roomId.trim() == "" {
        return "roomId is required";
    }
    return validateDate(date, now);
}
