import ballerina/os;

// Postgres (bookings-db wiring). Empty values mean "not configured".
configurable string dbHost = os:getEnv("BOOKINGS_DB_HOST");
configurable string dbPortText = os:getEnv("BOOKINGS_DB_PORT");
configurable string dbUser = os:getEnv("BOOKINGS_DB_USER");
configurable string dbPassword = os:getEnv("BOOKINGS_DB_PASSWORD");
configurable string dbName = os:getEnv("BOOKINGS_DB_DBNAME");

// IANA zone of the office; empty means UTC.
configurable string officeTimeZone = os:getEnv("OFFICE_TIME_ZONE");
