import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OUTER_REVIEW_AUTO_INNER_CONTENT_KEY,
  readAutoShowInnerContentPreference,
  writeAutoShowInnerContentPreference,
} from "./outerReviewPreferences";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("outer-review automatic inner-content preference storage", () => {
  it("defaults to off when the key is missing", () => {
    expect(readAutoShowInnerContentPreference()).toBe(false);
  });

  it("restores only the defined true representation", () => {
    window.localStorage.setItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY, "true");
    expect(readAutoShowInnerContentPreference()).toBe(true);

    window.localStorage.setItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY, "false");
    expect(readAutoShowInnerContentPreference()).toBe(false);
  });

  it.each(["TRUE", "1", "yes", "null", "", "unexpected"])(
    "falls back to off for invalid stored value %j",
    (value) => {
      window.localStorage.setItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY, value);
      expect(readAutoShowInnerContentPreference()).toBe(false);
    },
  );

  it("writes only true and false strings", () => {
    writeAutoShowInnerContentPreference(true);
    expect(
      window.localStorage.getItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY),
    ).toBe("true");

    writeAutoShowInnerContentPreference(false);
    expect(
      window.localStorage.getItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY),
    ).toBe("false");
  });

  it("falls back to off when localStorage reading fails", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage is blocked");
    });

    expect(readAutoShowInnerContentPreference()).toBe(false);
  });

  it("does not throw when localStorage writing fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage quota exceeded");
    });

    expect(() => writeAutoShowInnerContentPreference(true)).not.toThrow();
  });
});
