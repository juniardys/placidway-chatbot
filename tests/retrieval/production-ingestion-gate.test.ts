import { expect, test } from "vitest";
import { SOURCES } from "../../src/config/sources";
import { validateProductionSources } from "../../src/lib/ingestion/sources";

test("production ingestion requires exactly seven complete unique sources", () => {
  expect(SOURCES).toHaveLength(7);
  expect(new Set(SOURCES.map((source) => source.id)).size).toBe(7);
  expect(new Set(SOURCES.map((source) => source.url)).size).toBe(7);
});

test("production ingestion accepts configured assessment URLs", () => {
  expect(() => validateProductionSources()).not.toThrow();
});
