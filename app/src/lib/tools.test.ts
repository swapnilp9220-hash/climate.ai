import assert from "node:assert/strict";
import test from "node:test";
import { languageName } from "./agent-language.ts";
import { getMandiPrices, getWaterConsumption, getWeather, predictClimateRisk } from "./tools.ts";

test("selected response languages map to English, Hindi, and Marathi", () => {
  assert.equal(languageName("en"), "English");
  assert.equal(languageName("hi"), "Hindi");
  assert.equal(languageName("mr"), "Marathi");
});

test("invalid weather locations never reach a provider", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("should not be called"); };
  try {
    const result = await getWeather("x");
    assert.equal(result.available, false);
    assert.equal(called, false);
    assert.match(result.note ?? "", /at least 2 characters/i);
  } finally { globalThis.fetch = originalFetch; }
});

test("weather provider failures return an explicit unavailable result", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("network unavailable"); };
  try {
    const result = await getWeather("Dhule");
    assert.equal(result.available, false);
    assert.equal(result.dataType, "unavailable");
    assert.match(result.note ?? "", /network unavailable/);
    assert.ok(result.observedAt);
  } finally { globalThis.fetch = originalFetch; }
});

test("mandi lookup without credentials reports unavailable instead of a sample price", async () => {
  const previous = process.env.AGMARKNET_API_KEY;
  delete process.env.AGMARKNET_API_KEY;
  try {
    const result = await getMandiPrices("Wheat", "Dhule");
    assert.equal(result.available, false);
    assert.equal(result.data, null);
    assert.match(result.note ?? "", /not configured/);
  } finally { if (previous) process.env.AGMARKNET_API_KEY = previous; }
});

test("unconnected water meters do not claim consumption or savings", async () => {
  const result = await getWaterConsumption("Dhule");
  assert.equal(result.available, false);
  assert.equal(result.data, null);
  assert.match(result.note ?? "", /No water meter/);
});

test("climate screen calculates an elevated classification from returned forecast values", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) return Response.json({ results: [{ latitude: 20.9, longitude: 74.8, name: "Dhule", admin1: "Maharashtra", country: "India" }] });
    return Response.json({ current: { time: "2026-11-22T12:00", temperature_2m: 37 }, current_units: { temperature_2m: "°C" }, daily: { precipitation_sum: [0, 0, 0, 0, 0, 0, 0], temperature_2m_max: [37, 36, 38, 37, 36, 34, 33] } });
  };
  try {
    const result = await predictClimateRisk("Dhule");
    const data = result.data as { classification: string; sevenDayRainfallMm: number; daysAtOrAbove35C: number };
    assert.equal(result.available, true);
    assert.equal(result.dataType, "estimate");
    assert.equal(data.classification, "elevated");
    assert.equal(data.sevenDayRainfallMm, 0);
    assert.equal(data.daysAtOrAbove35C, 5);
    assert.match(result.note ?? "", /not an official drought index/);
  } finally { globalThis.fetch = originalFetch; }
});
