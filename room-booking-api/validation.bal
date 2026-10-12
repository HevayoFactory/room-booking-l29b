import ballerina/time;

// Bookable hours (P4): slots start 08:00 .. 17:00 and end by 18:00.
public const int OPEN_HOUR = 8;
public const int CLOSE_HOUR = 18;
// Booking horizon in days (P4).
public const int MAX_DAYS_AHEAD = 30;
const string DEFAULT_TIME_ZONE = "UTC";

# Office time zone from config (OFFICE_TIME_ZONE), UTC when unset.
final time:TimeZone officeZone = check new (officeTimeZone.trim() == "" ? DEFAULT_TIME_ZONE : officeTimeZone.trim());

# Current civil time in the office time zone.
#
# + return - now in the office zone
public function officeNow() returns time:Civil {
    return officeZone.utcToCivil(time:utcNow());
}

# Parses a YYYY-MM-DD date into a day number (days since 1970-01-01), or an error.
#
# + date - the date text
# + return - day number, or an error when the text is not a real calendar date
public function parseDayNumber(string date) returns int|error {
    if !re `[0-9]{4}-[0-9]{2}-[0-9]{2}`.isFullMatch(date) {
        return error("date must be YYYY-MM-DD");
    }
    int year = check int:fromString(date.substring(0, 4));
    int month = check int:fromString(date.substring(5, 7));
    int day = check int:fromString(date.substring(8, 10));
    time:Date probe = {year, month, day, hour: 0, minute: 0, second: 0};
    check time:dateValidate(probe);
    return dayNumber(year, month, day);
}

# Days since 1970-01-01 for a proleptic Gregorian date.
#
# + year - the year
# + month - month 1..12
# + day - day of month
# + return - day number
public function dayNumber(int year, int month, int day) returns int {
    int shiftYear = month <= 2 ? year - 1 : year;
    int era = (shiftYear >= 0 ? shiftYear : shiftYear - 399) / 400;
    int yearOfEra = shiftYear - era * 400;
    int monthIndex = month > 2 ? month - 3 : month + 9;
    int dayOfYear = (153 * monthIndex + 2) / 5 + day - 1;
    int dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear;
    return era * 146097 + dayOfEra - 719468;
}

# Checks the hour range of a booking: whole one-hour slots inside 08:00-18:00 (P3, P4).
#
# + startHour - first booked hour
# + endHour - end of the last booked hour, exclusive
# + return - a message when invalid, () when valid
public function validateHours(int startHour, int endHour) returns string? {
    if startHour < OPEN_HOUR || startHour >= CLOSE_HOUR {
        return "startHour must be between 8 and 17";
    }
    if endHour <= startHour {
        return "endHour must be later than startHour";
    }
    if endHour > CLOSE_HOUR {
        return "endHour must be at most 18";
    }
    return ();
}

# Checks a date is today or later and at most 30 days ahead, in the office time zone (P3, P4).
#
# + date - the YYYY-MM-DD text
# + now - the current civil time in the office zone
# + return - a message when invalid, () when valid
public function validateDate(string date, time:Civil now) returns string? {
    int|error target = parseDayNumber(date);
    if target is error {
        return target.message();
    }
    int today = dayNumber(now.year, now.month, now.day);
    if target < today {
        return "date must be today or later";
    }
    if target > today + MAX_DAYS_AHEAD {
        return "date must be at most 30 days ahead";
    }
    return ();
}

# Full booking-window check: hours, date window, and that a slot of today has not already
# started in an earlier hour. The slot of the current hour is still bookable.
#
# + date - the YYYY-MM-DD text
# + startHour - first booked hour
# + endHour - end of the last booked hour, exclusive
# + now - the current civil time in the office zone
# + return - a message when invalid, () when valid
public function validateBookingWindow(string date, int startHour, int endHour, time:Civil now) returns string? {
    string? hoursProblem = validateHours(startHour, endHour);
    if hoursProblem is string {
        return hoursProblem;
    }
    string? dateProblem = validateDate(date, now);
    if dateProblem is string {
        return dateProblem;
    }
    int|error target = parseDayNumber(date);
    if target is int && target == dayNumber(now.year, now.month, now.day) && startHour < now.hour {
        return "past slots cannot be booked";
    }
    return ();
}
