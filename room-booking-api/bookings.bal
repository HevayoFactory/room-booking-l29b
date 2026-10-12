import ballerina/http;
import ballerina/sql;
import ballerina/time;
import ballerinax/postgresql;

const int MAX_TITLE_LENGTH = 200;
# Outcome of a booking operation: the booking, or the refusal.
#
# + booking - the booking when the operation succeeded
# + problem - the refusal otherwise
type BookingResult record {|
    Booking? booking = ();
    BookingProblem? problem = ();
|};

const string SQLSTATE_EXCLUSION_VIOLATION = "23P01";

# 201 response of POST /me/bookings.
#
# + body - the created booking
public type BookingCreated record {|
    *http:Created;
    Booking body;
|};

# A business refusal from a booking operation, mapped to a 4xx by the resource.
#
# + kind - which refusal
# + description - detail shown to the caller
type BookingProblem record {|
    "badRequest"|"notFound"|"conflict" kind;
    string description;
|};

# YYYY-MM-DD of a civil time.
#
# + now - civil time
# + return - the date text
function dateText(time:Civil now) returns string {
    return string `${now.year}-${now.month < 10 ? "0" : ""}${now.month}-${now.day < 10 ? "0" : ""}${now.day}`;
}

# The name stored as bookedByName: the assertion's login name, else its subject.
#
# + caller - the verified caller
# + return - the display name to store
function bookerName(GatewayCaller caller) returns string {
    string name = caller.username.trim();
    return name == "" ? caller.userId : name;
}

# Request-level checks of POST /me/bookings (P3, P4, title).
#
# + input - the request body
# + now - current civil time in the office zone
# + return - a message when invalid, () when valid
function validateBookingInput(BookingInput input, time:Civil now) returns string? {
    if input.roomId.trim() == "" {
        return "roomId is required";
    }
    string? title = input?.title;
    if title is string && title.trim().length() > MAX_TITLE_LENGTH {
        return "title must be at most 200 characters";
    }
    return validateBookingWindow(input.date, input.startHour, input.endHour, now);
}

# Whether a booking can still be cancelled by its booker: its last hour has not ended.
#
# + date - booking date, YYYY-MM-DD
# + endHour - end of the last booked hour
# + now - current civil time in the office zone
# + return - true when upcoming
function isUpcoming(string date, int endHour, time:Civil now) returns boolean {
    int|error target = parseDayNumber(date);
    if target is error {
        return false;
    }
    int today = dayNumber(now.year, now.month, now.day);
    return target > today || (target == today && endHour > now.hour);
}

# Creates an active booking owned by the caller. The exclusion constraint decides
# conflicts, so a lost race books nothing.
#
# + caller - the verified caller
# + input - validated request body
# + return - the booking, a refusal, or an error
function createBooking(GatewayCaller caller, BookingInput input) returns BookingResult|error {
    postgresql:Client db = check getDb();
    string roomId = input.roomId.trim();
    int|sql:Error found = db->queryRow(`SELECT count(*) FROM rooms WHERE id = ${roomId} AND active`);
    if found is sql:Error {
        return found;
    }
    if found == 0 {
        return {problem: {kind: "notFound", description: "no such room"}};
    }
    string? rawTitle = input?.title;
    string? title = rawTitle is string && rawTitle.trim() != "" ? rawTitle.trim() : ();
    BookingRow|sql:Error row = db->queryRow(`WITH ins AS (
            INSERT INTO bookings (room_id, booking_date, start_hour, end_hour, title, booker_id, booked_by_name)
            VALUES (${roomId}, ${input.date}::date, ${input.startHour}, ${input.endHour}, ${title},
                ${caller.userId}, ${bookerName(caller)})
            RETURNING *)
        SELECT b.id, b.room_id, r.name AS room_name, b.booking_date::text AS date,
            b.start_hour, b.end_hour, b.title, b.booked_by_name, b.status, b.cancelled_by, b.cancel_reason
        FROM ins b JOIN rooms r ON r.id = b.room_id`);
    if row is sql:DatabaseError && row.detail().sqlState == SQLSTATE_EXCLUSION_VIOLATION {
        return {problem: {kind: "conflict", description: "a slot was taken by someone else; nothing was booked"}};
    }
    if row is sql:Error {
        return row;
    }
    return {booking: toBooking(row)};
}

# One page of the caller's bookings from today on: active ones, and those facilities
# cancelled, until their day has passed. Soonest first.
#
# + callerId - the caller's subject
# + today - YYYY-MM-DD in the office zone
# + 'limit - page size
# + offset - offset
# + return - the page, or an error
function loadMyBookings(string callerId, string today, int 'limit, int offset) returns BookingList|error {
    postgresql:Client db = check getDb();
    int total = check db->queryRow(`SELECT count(*) FROM bookings b
        WHERE b.booker_id = ${callerId} AND b.booking_date >= ${today}::date
        AND (b.status = 'active' OR b.cancelled_by = 'facilities')`);
    stream<BookingRow, sql:Error?> rows = db->query(`SELECT b.id, b.room_id, r.name AS room_name,
        b.booking_date::text AS date, b.start_hour, b.end_hour, b.title, b.booked_by_name,
        b.status, b.cancelled_by, b.cancel_reason
        FROM bookings b JOIN rooms r ON r.id = b.room_id
        WHERE b.booker_id = ${callerId} AND b.booking_date >= ${today}::date
        AND (b.status = 'active' OR b.cancelled_by = 'facilities')
        ORDER BY b.booking_date, b.start_hour, b.id LIMIT ${'limit} OFFSET ${offset}`);
    Booking[] bookings = check from BookingRow row in rows
        select toBooking(row);
    return {
        count: total,
        next: pageLink("/me/bookings", "", 'limit, offset + 'limit, offset + 'limit < total),
        previous: pageLink("/me/bookings", "", 'limit, offset - 'limit < 0 ? 0 : offset - 'limit, offset > 0),
        data: bookings
    };
}

# Cancels the caller's own upcoming active booking. A booking that is not the
# caller's is "not found", never a different refusal.
#
# + callerId - the caller's subject
# + bookingId - the booking
# + now - current civil time in the office zone
# + return - the cancelled booking, a refusal, or an error
function cancelOwnBooking(string callerId, string bookingId, time:Civil now) returns BookingResult|error {
    postgresql:Client db = check getDb();
    BookingRow|sql:Error current = db->queryRow(`SELECT b.id, b.room_id, r.name AS room_name,
        b.booking_date::text AS date, b.start_hour, b.end_hour, b.title, b.booked_by_name,
        b.status, b.cancelled_by, b.cancel_reason
        FROM bookings b JOIN rooms r ON r.id = b.room_id
        WHERE b.id = ${bookingId} AND b.booker_id = ${callerId}`);
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
            UPDATE bookings SET status = 'cancelled', cancelled_by = 'booker'
            WHERE id = ${bookingId} AND booker_id = ${callerId} AND status = 'active'
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

# Maps a business refusal to its error response.
#
# + problem - the refusal
# + return - the 400, 404 or 409 response
function problemResponse(BookingProblem problem) returns ErrorBadRequest|ErrorNotFound|ErrorConflict {
    if problem.kind == "notFound" {
        return notFound(problem.description);
    }
    if problem.kind == "conflict" {
        return <ErrorConflict>{body: {code: 409, message: "Conflict", description: problem.description}};
    }
    return badRequest(problem.description);
}

function notFound(string description) returns ErrorNotFound {
    return {body: {code: 404, message: "Not Found", description}};
}
