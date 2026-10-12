import ballerina/http;
import ballerina/sql;
import ballerina/time;
import ballerinax/postgresql;

const int MAX_ROOM_NAME_LENGTH = 100;
const int MAX_LOCATION_LENGTH = 200;
const int MAX_REASON_LENGTH = 500;
const string SQLSTATE_UNIQUE_VIOLATION = "23505";
const string DEACTIVATION_REASON = "The room was deactivated by facilities";

# 201 response of POST /admin/rooms.
#
# + body - the created room
public type RoomCreated record {|
    *http:Created;
    Room body;
|};

# 200 response of PATCH /admin/rooms/{roomId}.
#
# + body - the updated room
public type RoomOk record {|
    *http:Ok;
    Room body;
|};

# Outcome of a room operation: the room, or the refusal.
#
# + room - the room when the operation succeeded
# + problem - the refusal otherwise
type RoomResult record {|
    Room? room = ();
    BookingProblem? problem = ();
|};

# Checks a room name, capacity and location the same way for create and edit.
#
# + name - room name, when given
# + capacity - capacity, when given
# + location - location, when given
# + return - a message when invalid, () when valid
function validateRoomFields(string? name, int? capacity, string? location) returns string? {
    if name is string {
        string trimmed = name.trim();
        if trimmed == "" {
            return "name must not be empty";
        }
        if trimmed.length() > MAX_ROOM_NAME_LENGTH {
            return "name must be at most 100 characters";
        }
    }
    if capacity is int && capacity < 1 {
        return "capacity must be at least 1";
    }
    if location is string {
        string trimmed = location.trim();
        if trimmed == "" {
            return "location must not be empty";
        }
        if trimmed.length() > MAX_LOCATION_LENGTH {
            return "location must be at most 200 characters";
        }
    }
    return ();
}

# Request-level checks of POST /admin/rooms.
#
# + input - the request body
# + return - a message when invalid, () when valid
function validateRoomInput(RoomInput input) returns string? {
    return validateRoomFields(input.name, input.capacity, input.location);
}

# Request-level checks of PATCH /admin/rooms/{roomId}: at least one field, each valid.
#
# + patch - the request body
# + return - a message when invalid, () when valid
function validateRoomPatch(RoomPatch patch) returns string? {
    string? name = patch?.name;
    int? capacity = patch?.capacity;
    string? location = patch?.location;
    boolean? active = patch?.active;
    if name is () && capacity is () && location is () && active is () {
        return "at least one of name, capacity, location or active is required";
    }
    return validateRoomFields(name, capacity, location);
}

# Request-level check of the cancel reason: blank means none.
#
# + input - the request body, when any
# + return - a message when invalid, () when valid
function validateCancelInput(CancelInput? input) returns string? {
    string? reason = input is CancelInput ? input?.reason : ();
    if reason is string && reason.trim().length() > MAX_REASON_LENGTH {
        return "reason must be at most 500 characters";
    }
    return ();
}

# The reason to store: trimmed, or () when absent or blank.
#
# + input - the request body, when any
# + return - the reason, or ()
function reasonOf(CancelInput? input) returns string? {
    string? reason = input is CancelInput ? input?.reason : ();
    if reason is string && reason.trim() != "" {
        return reason.trim();
    }
    return ();
}

# Adds a room. Names are unique ignoring case.
#
# + input - validated request body
# + return - the room, a refusal, or an error
function createRoom(RoomInput input) returns RoomResult|error {
    postgresql:Client db = check getDb();
    RoomRow|sql:Error row = db->queryRow(`INSERT INTO rooms (name, capacity, location)
        VALUES (${input.name.trim()}, ${input.capacity}, ${input.location.trim()})
        RETURNING id, name, capacity, location, active`);
    if row is sql:DatabaseError && row.detail().sqlState == SQLSTATE_UNIQUE_VIOLATION {
        return {problem: {kind: "conflict", description: "a room with this name already exists"}};
    }
    if row is sql:Error {
        return row;
    }
    return {room: toRoom(row)};
}

# Edits a room. Setting active to false cancels the room's future active bookings in
# the same transaction, as cancelled by facilities, so the bookers see why.
#
# + roomId - the room
# + patch - validated request body
# + now - current civil time in the office zone
# + return - the room, a refusal, or an error
function updateRoom(string roomId, RoomPatch patch, time:Civil now) returns RoomResult|error {
    postgresql:Client db = check getDb();
    string? rawName = patch?.name;
    string? name = rawName is string ? rawName.trim() : ();
    string? rawLocation = patch?.location;
    string? location = rawLocation is string ? rawLocation.trim() : ();
    int? capacity = patch?.capacity;
    boolean? active = patch?.active;
    string today = dateText(now);
    // A failed statement jumps to the on fail clause, which rolls the transaction back.
    transaction {
        RoomRow row = check db->queryRow(`UPDATE rooms SET
                name = COALESCE(${name}::text, name),
                capacity = COALESCE(${capacity}::int, capacity),
                location = COALESCE(${location}::text, location),
                active = COALESCE(${active}::boolean, active)
            WHERE id = ${roomId}
            RETURNING id, name, capacity, location, active`);
        if active == false {
            _ = check db->execute(`UPDATE bookings
                SET status = 'cancelled', cancelled_by = 'facilities', cancel_reason = ${DEACTIVATION_REASON}
                WHERE room_id = ${roomId} AND status = 'active'
                AND (booking_date > ${today}::date
                    OR (booking_date = ${today}::date AND end_hour > ${now.hour}))`);
        }
        check commit;
        return {room: toRoom(row)};
    } on fail error cause {
        if cause is sql:NoRowsError {
            return {problem: {kind: "notFound", description: "no such room"}};
        }
        if cause is sql:DatabaseError && cause.detail().sqlState == SQLSTATE_UNIQUE_VIOLATION {
            return {problem: {kind: "conflict", description: "a room with this name already exists"}};
        }
        return cause;
    }
}

# Cancels any upcoming active booking as facilities, with an optional reason.
#
# + bookingId - the booking
# + reason - the reason shown to the booker, or ()
# + now - current civil time in the office zone
# + return - the cancelled booking, a refusal, or an error
function cancelAnyBooking(string bookingId, string? reason, time:Civil now) returns BookingResult|error {
    postgresql:Client db = check getDb();
    BookingRow|sql:Error current = db->queryRow(`SELECT b.id, b.room_id, r.name AS room_name,
        b.booking_date::text AS date, b.start_hour, b.end_hour, b.title, b.booked_by_name,
        b.status, b.cancelled_by, b.cancel_reason
        FROM bookings b JOIN rooms r ON r.id = b.room_id
        WHERE b.id = ${bookingId}`);
    if current is sql:NoRowsError {
        return {problem: {kind: "notFound", description: "no such booking"}};
    }
    if current is sql:Error {
        return current;
    }
    if current.status != "active" {
        return {problem: {kind: "badRequest", description: "booking is already cancelled"}};
    }
    if !isUpcoming(current.date, current.endHour, now) {
        return {problem: {kind: "badRequest", description: "past bookings cannot be cancelled"}};
    }
    BookingRow|sql:Error done = db->queryRow(`WITH upd AS (
            UPDATE bookings SET status = 'cancelled', cancelled_by = 'facilities', cancel_reason = ${reason}
            WHERE id = ${bookingId} AND status = 'active'
            RETURNING *)
        SELECT b.id, b.room_id, r.name AS room_name, b.booking_date::text AS date,
            b.start_hour, b.end_hour, b.title, b.booked_by_name, b.status, b.cancelled_by, b.cancel_reason
        FROM upd b JOIN rooms r ON r.id = b.room_id`);
    if done is sql:NoRowsError {
        return {problem: {kind: "badRequest", description: "booking is already cancelled"}};
    }
    if done is sql:Error {
        return done;
    }
    return {booking: toBooking(done)};
}
