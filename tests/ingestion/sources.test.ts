import { expect, test } from "vitest";
import { SOURCES } from "../../src/config/sources";
import {
  assertAllowedSource,
  validateProductionSources,
  type AllowedSource,
} from "../../src/lib/ingestion/sources";
import {
  createPacer,
  fetchSource,
  IDENTIFIABLE_USER_AGENT,
} from "../../src/lib/ingestion/fetcher";
test("allowlist and production gate", () => {
  expect(SOURCES).toHaveLength(7);
  expect(assertAllowedSource(SOURCES[0].url).id).toBe(SOURCES[0].id);
  expect(() => assertAllowedSource("https://nope.example")).toThrow();
  expect(() => validateProductionSources()).not.toThrow();
});
test("robots, UA, metadata, injected pacing", async () => {
  const calls: RequestInit[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init ?? {});
    return new Response(
      String(input).toString().endsWith("robots.txt")
        ? "User-agent: *\nDisallow: /blocked\nAllow: /blocked/ok"
        : "<html>x</html>",
      { headers: { x: "y" } },
    );
  };
  const pacer = { wait: async () => {} };
  const allowedSource = (url: string): AllowedSource => ({
    ...SOURCES[0],
    url,
  }) as AllowedSource;
  const result = await fetchSource(
    allowedSource("https://example.com/blocked/ok"),
    fetcher,
    pacer,
  );
  expect(result.sourceId).toBe(SOURCES[0].id);
  expect(calls[1].headers).toEqual({ "User-Agent": IDENTIFIABLE_USER_AGENT });
  await expect(
    fetchSource(
      allowedSource("https://example.com/blocked"),
      fetcher,
      pacer,
    ),
  ).rejects.toThrow("robots");
});
test("pacer is injectable", async () => {
  let count = 0;
  await createPacer(
    0,
    () => 1,
    async () => {
      count++;
    },
  ).wait();
  expect(count).toBe(0);
});
