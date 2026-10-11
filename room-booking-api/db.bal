import ballerina/log;
import ballerinax/postgresql;
import ballerinax/postgresql.driver as _;
import ballerina/sql;

final postgresql:Client db = check initClient();

function initClient() returns postgresql:Client|error {
    DbSettings settings = check dbSettings();
    return new (settings.host, settings.user, settings.password, settings.database, settings.port);
}

// Runs before the listener starts; a failure stops the service.
final () dbReady = check initSchema();

function initSchema() returns error? {
    transaction {
        // Serialise concurrent replicas starting at once.
        string? _ = check db->queryRow(`SELECT pg_advisory_xact_lock(727001)::text`);
        _ = check db->execute(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
        _ = check db->execute(`
            CREATE TABLE IF NOT EXISTS rooms (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                name text NOT NULL,
                capacity integer NOT NULL CHECK (capacity >= 1),
                location text NOT NULL,
                active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now()
            )`);
        _ = check db->execute(`
            CREATE UNIQUE INDEX IF NOT EXISTS rooms_name_unique ON rooms (lower(name))`);
        // P2: no two active bookings of a room overlap on a date, enforced by the database.
        _ = check db->execute(`
            CREATE TABLE IF NOT EXISTS bookings (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                room_id uuid NOT NULL REFERENCES rooms (id),
                booking_date date NOT NULL,
                start_hour integer NOT NULL CHECK (start_hour BETWEEN 8 AND 17),
                end_hour integer NOT NULL CHECK (end_hour BETWEEN 9 AND 18),
                title text,
                booker_id text NOT NULL,
                booked_by_name text NOT NULL,
                status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
                cancelled_by text CHECK (cancelled_by IN ('booker', 'facilities')),
                cancel_reason text,
                created_at timestamptz NOT NULL DEFAULT now(),
                CHECK (end_hour > start_hour),
                CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
                    room_id WITH =,
                    booking_date WITH =,
                    int4range(start_hour, end_hour) WITH &&
                ) WHERE (status = 'active')
            )`);
        _ = check db->execute(`
            CREATE INDEX IF NOT EXISTS bookings_booker_idx ON bookings (booker_id, booking_date)`);
        check commit;
    }
    log:printInfo("bookings schema ready");
}

// True when the error is a violation of the no-overlap constraint (map to 409).
function isOverlapViolation(error e) returns boolean {
    return e is sql:DatabaseError && e.message().includes("bookings_no_overlap");
}

// True when the error is a violation of the unique room name index (map to 409).
function isDuplicateRoomName(error e) returns boolean {
    return e is sql:DatabaseError && e.message().includes("rooms_name_unique");
}
