import { describe, it, expect } from "vitest";
import { truncate, monogram, formatDate, interactionTypeMeta } from "./helpers";

describe("truncate", () => {
  it("leaves short strings untouched", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("clips long strings and appends an ellipsis", () => {
    expect(truncate("hello world", 5)).toBe("hello…");
  });
  it("returns empty string for falsy input", () => {
    expect(truncate("", 5)).toBe("");
  });
});

describe("monogram", () => {
  it("uses first + last initial for multi-word names", () => {
    expect(monogram("Frontier Quest 3")).toBe("F3");
  });
  it("uses first two chars for single words", () => {
    expect(monogram("Words")).toBe("WO");
  });
  it("falls back to ? when there is nothing usable", () => {
    expect(monogram("   ")).toBe("?");
  });
});

describe("formatDate", () => {
  it("renders an em dash for null/undefined", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
  it("renders 'Today' for the current moment", () => {
    expect(formatDate(new Date())).toBe("Today");
  });
});

describe("interactionTypeMeta", () => {
  it("returns the matching type", () => {
    expect(interactionTypeMeta("meeting").label).toBe("Meeting");
  });
  it("falls back to 'other' for unknown types", () => {
    expect(interactionTypeMeta("nope").label).toBe("Other");
  });
});
