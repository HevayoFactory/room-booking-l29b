import ballerina/test;
import ballerina/time;

time:Civil sampleNow = {year: 2026, month: 10, day: 12, hour: 10, minute: 30, second: 0};

@test:Config {}
function hoursRules() {
    test:assertEquals(validateHours(8, 9), ());
    test:assertEquals(validateHours(17, 18), ());
    test:assertTrue(validateHours(7, 8) is string);
    test:assertTrue(validateHours(9, 9) is string);
    test:assertTrue(validateHours(17, 19) is string);
}

@test:Config {}
function dateWindow() {
    test:assertEquals(validateDate("2026-10-12", sampleNow), ());
    test:assertEquals(validateDate("2026-11-11", sampleNow), ());
    test:assertTrue(validateDate("2026-11-12", sampleNow) is string);
    test:assertTrue(validateDate("2026-10-11", sampleNow) is string);
    test:assertTrue(validateDate("2026-02-30", sampleNow) is string);
    test:assertTrue(validateDate("tomorrow", sampleNow) is string);
}

@test:Config {}
function pastSlotsToday() {
    test:assertTrue(validateBookingWindow("2026-10-12", 9, 10, sampleNow) is string);
    test:assertEquals(validateBookingWindow("2026-10-12", 10, 11, sampleNow), ());
    test:assertEquals(validateBookingWindow("2026-10-13", 8, 9, sampleNow), ());
}
