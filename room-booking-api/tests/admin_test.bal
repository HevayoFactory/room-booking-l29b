import ballerina/http;
import ballerina/test;
import ballerina/time;

time:Civil adminNow = {year: 2026, month: 10, day: 5, hour: 10, minute: 30, second: 0};

@test:Config {}
function roomInputRules() {
    test:assertEquals(validateRoomInput({name: "Atlas", capacity: 6, location: "L2"}), ());
    test:assertTrue(validateRoomInput({name: " ", capacity: 6, location: "L2"}) is string);
    test:assertTrue(validateRoomInput({name: "Atlas", capacity: 0, location: "L2"}) is string);
    test:assertTrue(validateRoomInput({name: "Atlas", capacity: 6, location: ""}) is string);
    string longName = string:'join("", ...from int i in 0 ..< 101 select "x");
    test:assertTrue(validateRoomInput({name: longName, capacity: 6, location: "L2"}) is string);
}

@test:Config {}
function roomPatchRules() {
    test:assertTrue(validateRoomPatch({}) is string);
    test:assertEquals(validateRoomPatch({active: false}), ());
    test:assertEquals(validateRoomPatch({name: "Nova", capacity: 4}), ());
    test:assertTrue(validateRoomPatch({capacity: 0}) is string);
    test:assertTrue(validateRoomPatch({name: "  "}) is string);
}

@test:Config {}
function cancelReasonRules() {
    test:assertEquals(validateCancelInput(()), ());
    test:assertEquals(reasonOf(()), ());
    test:assertEquals(reasonOf({}), ());
    test:assertEquals(reasonOf({reason: "  "}), ());
    test:assertEquals(reasonOf({reason: " Maintenance "}), "Maintenance");
    string longReason = string:'join("", ...from int i in 0 ..< 501 select "x");
    test:assertTrue(validateCancelInput({reason: longReason}) is string);
}

@test:Config {}
function adminResourcesWithoutCallerAre401() returns error? {
    http:Client client1 = check new ("http://localhost:9090");
    http:Response created = check client1->post("/admin/rooms", {name: "Atlas", capacity: 6, location: "L2"});
    test:assertEquals(created.statusCode, 401);
    http:Response patched = check client1->patch("/admin/rooms/r1", {active: false});
    test:assertEquals(patched.statusCode, 401);
    http:Response cancelled = check client1->post("/bookings/b1/cancel", {reason: "x"});
    test:assertEquals(cancelled.statusCode, 401);
}
