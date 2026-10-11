import ballerina/os;

// Platform-injected wiring names; every setting has a default applied in dbSettings().
configurable string dbHost = os:getEnv("BOOKINGS_DB_HOST");
configurable string dbPort = os:getEnv("BOOKINGS_DB_PORT");
configurable string dbName = os:getEnv("BOOKINGS_DB_DBNAME");
configurable string dbUser = os:getEnv("BOOKINGS_DB_USER");
configurable string dbPassword = os:getEnv("BOOKINGS_DB_PASSWORD");

// IANA zone of the office, e.g. "Asia/Colombo". Empty means UTC.
configurable string officeZone = os:getEnv("OFFICE_TIME_ZONE");

type DbSettings record {|
    string host;
    int port;
    string database;
    string user;
    string password;
|};

function orDefault(string value, string fallback) returns string {
    return value.trim() == "" ? fallback : value.trim();
}

function dbSettings() returns DbSettings|error {
    int portNumber = check int:fromString(orDefault(dbPort, "5432"));
    return {
        host: orDefault(dbHost, "localhost"),
        port: portNumber,
        database: orDefault(dbName, "bookings"),
        user: orDefault(dbUser, "postgres"),
        password: dbPassword
    };
}

function officeTimeZone() returns string {
    return orDefault(officeZone, "UTC");
}
