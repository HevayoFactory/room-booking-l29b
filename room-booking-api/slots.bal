import ballerina/time;

// P3/P4: fixed one-hour slots, 08:00 to 18:00, bookable today up to 30 days ahead.
const int OPEN_HOUR = 8;
const int CLOSE_HOUR = 18;
const int MAX_DAYS_AHEAD = 30;

// The office's current date and hour, in the configured office zone.
type OfficeNow record {|
    string today;
    int hour;
|};

function officeNow() returns OfficeNow|error {
    string zone = officeTimeZone();
    return db->queryRow(`
        SELECT to_char(now() AT TIME ZONE ${zone}, 'YYYY-MM-DD') AS today,
               extract(hour FROM now() AT TIME ZONE ${zone})::int AS hour`);
}

// Checks a run of consecutive slots. Returns an error message, or () when valid.
function validateSlotRange(int startHour, int endHour) returns string? {
    if startHour < OPEN_HOUR || startHour >= CLOSE_HOUR {
        return "startHour must be between 8 and 17";
    }
    if endHour <= OPEN_HOUR || endHour > CLOSE_HOUR {
        return "endHour must be between 9 and 18";
    }
    if endHour <= startHour {
        return "endHour must be later than startHour";
    }
    return ();
}

// Parses YYYY-MM-DD into a day number (days since 1970-01-01), or an error.
function dayNumber(string date) returns int|error {
    time:Utc utc = check time:utcFromString(date + "T00:00:00Z");
    return utc[0] / 86400;
}

// P3/P4: the day must lie within [today, today + 30 days]; a slot that started
// earlier today is past. Returns an error message, or () when bookable.
function validateBookableSlot(string date, int startHour, OfficeNow now) returns string? {
    int|error day = dayNumber(date);
    int|error todayDay = dayNumber(now.today);
    if day is error || todayDay is error {
        return "date must be a valid YYYY-MM-DD date";
    }
    if day < todayDay {
        return "past days cannot be booked";
    }
    if day > todayDay + MAX_DAYS_AHEAD {
        return "days can be booked up to 30 days ahead";
    }
    if day == todayDay && startHour < now.hour {
        return "past slots cannot be booked";
    }
    return ();
}

// The day only (no slot): same window, used for viewing availability.
function validateViewableDay(string date, OfficeNow now) returns string? {
    return validateBookableSlot(date, CLOSE_HOUR - 1, now);
}

// Every one-hour slot start of the day that is still open at `now` for `date`.
function openSlotHours(string date, OfficeNow now) returns int[] {
    int[] hours = [];
    foreach int hour in OPEN_HOUR ..< CLOSE_HOUR {
        if validateBookableSlot(date, hour, now) is () {
            hours.push(hour);
        }
    }
    return hours;
}

function errorBody(int code, string message) returns Error {
    return {code, message};
}
