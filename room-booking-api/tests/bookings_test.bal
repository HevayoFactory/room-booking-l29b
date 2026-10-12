import ballerina/http;
import ballerina/test;
import ballerina/time;

time:Civil bookNow = {year: 2026, month: 10, day: 5, hour: 10, minute: 30, second: 0};

@test:Config {}
function dateTextIsZeroPadded() {
    test:assertEquals(dateText(bookNow), "2026-10-05");
}

@test:Config {}
function bookerNameFallsBackToSubject() {
    test:assertEquals(bookerName({userId: "sub-1", username: "alice", scopes: [], orgHandle: ""}), "alice");
    test:assertEquals(bookerName({userId: "sub-1", username: " ", scopes: [], orgHandle: ""}), "sub-1");
}

@test:Config {}
function bookingInputRules() {
    test:assertEquals(validateBookingInput({roomId: "r1", date: "2026-10-06", startHour: 9, endHour: 11}, bookNow), ());
    test:assertEquals(validateBookingInput({roomId: "r1", date: "2026-10-05", startHour: 10, endHour: 12, title: "Sync"}, bookNow), ());
    test:assertTrue(validateBookingInput({roomId: " ", date: "2026-10-06", startHour: 9, endHour: 10}, bookNow) is string);
    test:assertTrue(validateBookingInput({roomId: "r1", date: "2026-10-04", startHour: 9, endHour: 10}, bookNow) is string);
    test:assertTrue(validateBookingInput({roomId: "r1", date: "2026-10-05", startHour: 9, endHour: 10}, bookNow) is string);
    test:assertTrue(validateBookingInput({roomId: "r1", date: "2026-10-06", startHour: 11, endHour: 11}, bookNow) is string);
    test:assertTrue(validateBookingInput({roomId: "r1", date: "2026-11-05", startHour: 9, endHour: 10}, bookNow) is string);
    string longTitle = string:'join("", ...from int i in 0 ..< 201 select "x");
    test:assertTrue(validateBookingInput({roomId: "r1", date: "2026-10-06", startHour: 9, endHour: 10, title: longTitle}, bookNow) is string);
}

@test:Config {}
function upcomingMeansLastHourNotEnded() {
    test:assertTrue(isUpcoming("2026-10-06", 9, bookNow));
    test:assertTrue(isUpcoming("2026-10-05", 11, bookNow));
    test:assertFalse(isUpcoming("2026-10-05", 10, bookNow));
    test:assertFalse(isUpcoming("2026-10-04", 18, bookNow));
    test:assertFalse(isUpcoming("garbage", 18, bookNow));
}

@test:Config {}
function problemsMapToStatuses() {
    test:assertTrue(problemResponse({kind: "notFound", description: "x"}) is ErrorNotFound);
    test:assertTrue(problemResponse({kind: "conflict", description: "x"}) is ErrorConflict);
    test:assertTrue(problemResponse({kind: "badRequest", description: "x"}) is ErrorBadRequest);
}

// No assertion reaches the resources: each answers 401, never an anonymous success.
@test:Config {}
function bookingResourcesWithoutCallerAre401() returns error? {
    http:Client client1 = check new ("http://localhost:9090");
    http:Response listed = check client1->get("/me/bookings");
    test:assertEquals(listed.statusCode, 401);
    http:Response created = check client1->post("/me/bookings",
        {roomId: "r1", date: "2026-10-12", startHour: 9, endHour: 10});
    test:assertEquals(created.statusCode, 401);
    http:Response cancelled = check client1->post("/me/bookings/b1/cancel", ());
    test:assertEquals(cancelled.statusCode, 401);
}
