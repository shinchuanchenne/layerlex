import { describe, expect, it } from "vitest";

import { deterministicShuffle, parseShuffleSeed } from "./reviewShuffle";

describe("deterministic review shuffle", () => {
  it("handles empty and one-card inputs", () => {
    expect(deterministicShuffle([], 12)).toEqual([]);
    expect(deterministicShuffle(["only"], 12)).toEqual(["only"]);
  });

  it("does not mutate the source array", () => {
    const source = ["a", "b", "c", "d"];
    const snapshot = [...source];

    const result = deterministicShuffle(source, 42);

    expect(source).toEqual(snapshot);
    expect(result).not.toBe(source);
  });

  it("produces the same complete permutation for the same seed", () => {
    const source = ["a", "b", "c", "d", "e", "f"];

    const first = deterministicShuffle(source, 987654321);
    const second = deterministicShuffle(source, 987654321);

    expect(first).toEqual(second);
    expect(first).toHaveLength(source.length);
    expect(new Set(first)).toEqual(new Set(source));
  });

  it("allows different seeds to produce different orders", () => {
    const source = ["a", "b", "c", "d", "e", "f", "g", "h"];

    expect(deterministicShuffle(source, 1)).not.toEqual(
      deterministicShuffle(source, 2),
    );
  });

  it("contains every source item exactly once without omissions", () => {
    const source = Array.from({ length: 100 }, (_, index) => "card-" + index);
    const result = deterministicShuffle(source, 20260714);

    expect(result).toHaveLength(source.length);
    expect(new Set(result).size).toBe(source.length);
    expect([...result].sort()).toEqual([...source].sort());
  });
});

describe("shuffle seed parsing", () => {
  it.each([
    ["0", 0],
    ["42", 42],
    ["4294967295", 4294967295],
  ])("accepts unsigned 32-bit seed %s", (value, expected) => {
    expect(parseShuffleSeed(value)).toBe(expected);
  });

  it.each([null, "", "-1", "1.5", "abc", "4294967296"])(
    "rejects invalid seed %s",
    (value) => {
      expect(parseShuffleSeed(value)).toBeNull();
    },
  );
});
