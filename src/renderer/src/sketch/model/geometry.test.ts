// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { setPickReach, slackAt } from "./geometry";

// The reach is settled once by the app and read by every hit test, so a test
// that changes it puts it back.
afterEach(() => setPickReach(false));

describe("how much room a click is given", () => {
  it("is a pointer's worth by default", () => {
    expect(slackAt(1)).toBe(5);
  });

  it("is a good deal more for a finger", () => {
    setPickReach(true);
    expect(slackAt(1)).toBe(13);
  });

  it("shrinks with the zoom, so it stays the same size on screen", () => {
    expect(slackAt(2)).toBe(2.5);
    setPickReach(true);
    expect(slackAt(2)).toBe(6.5);
  });

  it("goes back to a pointer's worth when the screen is not one to aim at", () => {
    setPickReach(true);
    setPickReach(false);
    expect(slackAt(1)).toBe(5);
  });
});
