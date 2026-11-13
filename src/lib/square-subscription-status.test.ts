import { describe, expect, it } from "vitest";
import { squareSubscriptionStatus } from "./square-membership-sync.server";

describe("squareSubscriptionStatus", () => {
  it("treats an ACTIVE subscription with canceled_date as canceled", () => {
    // Square keeps status ACTIVE until the paid period ends; canceled_date is
    // the only reliable signal that the member will not be billed again.
    expect(squareSubscriptionStatus({ status: "ACTIVE", canceled_date: "2026-11-10" })).toBe("canceled");
  });

  it("treats a DEACTIVATED subscription with canceled_date as canceled", () => {
    expect(squareSubscriptionStatus({ status: "DEACTIVATED", canceled_date: "2026-11-10" })).toBe("canceled");
  });

  it("maps ACTIVE and PENDING to active when not canceled", () => {
    expect(squareSubscriptionStatus({ status: "ACTIVE" })).toBe("active");
    expect(squareSubscriptionStatus({ status: "PENDING" })).toBe("active");
    expect(squareSubscriptionStatus({ status: "ACTIVE", canceled_date: null })).toBe("active");
  });

  it("maps PAUSED to past_due", () => {
    expect(squareSubscriptionStatus({ status: "PAUSED" })).toBe("past_due");
  });

  it("maps CANCELED and DEACTIVATED to canceled", () => {
    expect(squareSubscriptionStatus({ status: "CANCELED" })).toBe("canceled");
    expect(squareSubscriptionStatus({ status: "DEACTIVATED" })).toBe("canceled");
  });
});
