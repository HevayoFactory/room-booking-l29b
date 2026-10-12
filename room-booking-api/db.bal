import ballerina/lang.runtime;
import ballerina/log;
import ballerina/sql;
import ballerinax/postgresql;
import ballerinax/postgresql.driver as _;

// Schema. The EXCLUDE constraint is the DB-enforced no-overlap rule (P2): two active
// bookings of one room on one date cannot hold overlapping hour ranges. Cancelled
// bookings are outside the constraint, so their slots free up.
function schemaStatements() returns sql:ParameterizedQuery[] {
    return [
        `CREATE EXTENSION IF NOT EXISTS btree_gist`,
        `CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            name TEXT NOT NULL,
            capacity INTEGER NOT NULL CHECK (capacity >= 1),
            location TEXT NOT NULL,
            active BOOLEAN NOT NULL DEFAULT TRUE)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS rooms_name_unique ON rooms (lower(name))`,
        `CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            room_id TEXT NOT NULL REFERENCES rooms(id),
            booking_date DATE NOT NULL,
            start_hour INTEGER NOT NULL CHECK (start_hour BETWEEN 8 AND 17),
            end_hour INTEGER NOT NULL CHECK (end_hour BETWEEN 9 AND 18),
            title TEXT,
            booker_id TEXT NOT NULL,
            booked_by_name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
            cancelled_by TEXT CHECK (cancelled_by IN ('booker', 'facilities')),
            cancel_reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CHECK (end_hour > start_hour),
            CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
                room_id WITH =, booking_date WITH =, int4range(start_hour, end_hour) WITH &&)
                WHERE (status = 'active'))`,
        `CREATE INDEX IF NOT EXISTS bookings_booker_idx ON bookings (booker_id, booking_date)`,
        `CREATE INDEX IF NOT EXISTS bookings_room_date_idx ON bookings (room_id, booking_date)`
    ];
}

final postgresql:Client|error dbClient = connectDb();
boolean schemaReady = false;

function connectDb() returns postgresql:Client|error {
    if dbHost.trim() == "" {
        return error("BOOKINGS_DB_HOST is not set");
    }
    int port = dbPortText.trim() == "" ? 5432 : check int:fromString(dbPortText.trim());
    return new (dbHost, dbUser, dbPassword, dbName, port);
}

# The database client once the schema exists, or an error describing why not.
#
# + return - the client, or an error when the database is unreachable or not configured
public function getDb() returns postgresql:Client|error {
    postgresql:Client|error db = dbClient;
    if db is error {
        return db;
    }
    if !schemaReady {
        check createSchema(db);
    }
    return db;
}

function createSchema(postgresql:Client db) returns error? {
    foreach sql:ParameterizedQuery statement in schemaStatements() {
        _ = check db->execute(statement);
    }
    schemaReady = true;
}

// Creates the schema at startup. A database that is not up yet does not stop the
// service from starting: the attempt is retried in the background and on first use.
function schemaSetupLoop() {
    foreach int attempt in 1 ... 30 {
        postgresql:Client|error db = getDb();
        if db is postgresql:Client {
            log:printInfo("database schema ready");
            return;
        }
        log:printWarn("database schema not ready", attempt = attempt, 'error = db);
        runtime:sleep(5);
    }
}

function init() {
    _ = start schemaSetupLoop();
}
