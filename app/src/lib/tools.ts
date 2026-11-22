import { requiredText } from "./input-validation.ts";

export type ToolResult = {
  available: boolean;
  data: unknown;
  source: string;
  observedAt: string;
  dataType: "live" | "historical" | "estimate" | "unavailable";
  units?: Record<string, string>;
  note?: string;
};

const timestamp = () => new Date().toISOString();
const unavailable = (source: string, note: string): ToolResult => ({
  available: false, data: null, source, observedAt: timestamp(), dataType: "unavailable", note,
});

async function fetchJson(url: string, source: string): Promise<any> {
  const response = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}`);
  return response.json();
}

async function coordinates(location: string) {
  const query = requiredText(location, "Location", 2, 120);
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: query, count: "1", language: "en", format: "json" }).toString();
  const result = await fetchJson(url.toString(), "Open-Meteo geocoding");
  const place = result.results?.[0];
  if (!place) throw new Error(`No coordinates found for ${query}`);
  return { latitude: place.latitude, longitude: place.longitude, name: [place.name, place.admin1, place.country].filter(Boolean).join(", ") };
}

export async function getWeather(location: string): Promise<ToolResult> {
  try {
    const place = await coordinates(location);
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: "temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m", daily: "precipitation_sum,temperature_2m_max,temperature_2m_min", timezone: "auto", forecast_days: "7" }).toString();
    const result = await fetchJson(url.toString(), "Open-Meteo");
    return { available: true, data: { location: place.name, current: result.current, daily: result.daily }, source: "Open-Meteo forecast API", observedAt: result.current?.time ?? timestamp(), dataType: "live", units: result.current_units };
  } catch (error) { return unavailable("Open-Meteo", error instanceof Error ? error.message : "Weather service unavailable"); }
}

export async function getSoilInformation(location: string): Promise<ToolResult> {
  try {
    const place = await coordinates(location);
    const url = new URL("https://rest.isric.org/soilgrids/v2.0/properties/query");
    const query = new URLSearchParams({ lon: String(place.longitude), lat: String(place.latitude), depth: "0-5cm", value: "mean" });
    query.append("property", "phh2o"); query.append("property", "soc"); query.append("property", "clay");
    url.search = query.toString();
    const data = await fetchJson(url.toString(), "ISRIC SoilGrids");
    return { available: true, data: { location: place.name, properties: data.properties }, source: "ISRIC SoilGrids", observedAt: timestamp(), dataType: "historical", note: "Gridded global soil estimates; verify with a local soil test before applying inputs." };
  } catch (error) { return unavailable("ISRIC SoilGrids", error instanceof Error ? error.message : "Soil service unavailable"); }
}

export async function getMandiPrices(crop: string, location: string): Promise<ToolResult> {
  const cleanCrop = requiredText(crop, "Crop", 2, 80);
  const cleanLocation = requiredText(location, "Location", 2, 120);
  if (!process.env.AGMARKNET_API_KEY) return unavailable("Agmarknet / data.gov.in", "AGMARKNET_API_KEY is not configured. No mandi prices were retrieved.");
  try {
    const url = new URL("https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070");
    url.search = new URLSearchParams({ "api-key": process.env.AGMARKNET_API_KEY, format: "json", limit: "25", "filters[Commodity]": cleanCrop, "filters[District]": cleanLocation }).toString();
    const data = await fetchJson(url.toString(), "data.gov.in Agmarknet");
    return { available: true, data: data.records ?? [], source: "data.gov.in Agmarknet", observedAt: timestamp(), dataType: "live", units: { modal_price: "INR per quintal" } };
  } catch (error) { return unavailable("data.gov.in Agmarknet", error instanceof Error ? error.message : "Mandi service unavailable"); }
}

export async function predictClimateRisk(location: string): Promise<ToolResult> {
  const weather = await getWeather(location);
  if (!weather.available) return unavailable(weather.source, `Risk not calculated: ${weather.note}`);
  const data = weather.data as any;
  const rainfall = (data.daily?.precipitation_sum ?? []).slice(0, 7).reduce((sum: number, value: number) => sum + value, 0);
  const highs: number[] = data.daily?.temperature_2m_max ?? [];
  const hotDays = highs.filter((value) => value >= 35).length;
  // Transparent short-term screening heuristic only; not a seasonal drought forecast.
  const risk = rainfall < 5 || hotDays >= 5 ? "elevated" : rainfall < 20 || hotDays >= 3 ? "watch" : "lower short-term signal";
  return { available: true, data: { location: data.location, sevenDayRainfallMm: rainfall, daysAtOrAbove35C: hotDays, classification: risk, method: "7-day forecast screen: elevated if rainfall <5 mm or >=5 days at >=35 C; watch if rainfall <20 mm or >=3 hot days; otherwise lower short-term signal." }, source: "Derived from Open-Meteo 7-day forecast", observedAt: timestamp(), dataType: "estimate", units: { sevenDayRainfallMm: "mm", temperature: "°C" }, note: "Short-range screening heuristic, not an official drought index or seasonal assessment." };
}

export async function getWaterConsumption(location: string): Promise<ToolResult> {
  requiredText(location, "Location", 2, 120);
  return unavailable("Connected farm meter", "No water meter or consumption database is connected. Connect a verified source before calculating usage or savings.");
}
export async function getSolarEnergyStatus(location: string): Promise<ToolResult> {
  requiredText(location, "Location", 2, 120);
  return unavailable("Connected solar inverter", "No solar inverter feed is connected. No generation estimate is available.");
}
export async function analyzeResourceDemand(location: string): Promise<ToolResult> {
  requiredText(location, "Location", 2, 120);
  return unavailable("Connected resource meters", "No water, electricity, or traffic baseline data is connected. Potential savings cannot be quantified.");
}

export async function analyzeCropConditions(crop: string, location: string): Promise<ToolResult> {
  const cleanCrop = requiredText(crop, "Crop", 2, 80);
  const cleanLocation = requiredText(location, "Location", 2, 120);
  const [weather, soil] = await Promise.all([getWeather(cleanLocation), getSoilInformation(cleanLocation)]);
  return { available: weather.available || soil.available, data: { crop: cleanCrop, weather, soil }, source: "Open-Meteo + ISRIC SoilGrids", observedAt: timestamp(), dataType: "estimate", note: "Suitability requires crop-specific local calibration and verified field conditions; this result summarizes available inputs only." };
}
export async function estimateCropYield(crop: string, location: string): Promise<ToolResult> {
  requiredText(crop, "Crop", 2, 80); requiredText(location, "Location", 2, 120);
  return unavailable("Yield model", "No validated crop-specific yield model or field baseline is configured. Yield was not estimated.");
}

export const toolRegistry = { get_weather: getWeather, get_soil_information: getSoilInformation, get_mandi_prices: getMandiPrices, analyze_crop_conditions: analyzeCropConditions, predict_climate_risk: predictClimateRisk, estimate_crop_yield: estimateCropYield, get_water_consumption: getWaterConsumption, get_solar_energy_status: getSolarEnergyStatus, analyze_resource_demand: analyzeResourceDemand };
export const toolSchemas: Record<string, { description: string; parameters: Record<string, unknown> }> = {
  get_weather: { description: "Retrieve current conditions and a 7-day forecast for a place", parameters: { type: "object", properties: { location: { type: "string" } }, required: ["location"], additionalProperties: false } },
  get_soil_information: { description: "Retrieve gridded soil properties for a place", parameters: { type: "object", properties: { location: { type: "string" } }, required: ["location"], additionalProperties: false } },
  get_mandi_prices: { description: "Retrieve official mandi price records for crop and state/location", parameters: { type: "object", properties: { crop: { type: "string" }, location: { type: "string" } }, required: ["crop", "location"], additionalProperties: false } },
  analyze_crop_conditions: { description: "Summarize available weather and soil inputs for a crop", parameters: { type: "object", properties: { crop: { type: "string" }, location: { type: "string" } }, required: ["crop", "location"], additionalProperties: false } },
  predict_climate_risk: { description: "Calculate a transparent short-term heat and rainfall screening classification", parameters: { type: "object", properties: { location: { type: "string" } }, required: ["location"], additionalProperties: false } },
  estimate_crop_yield: { description: "Estimate crop yield only if a validated local yield model is available", parameters: { type: "object", properties: { crop: { type: "string" }, location: { type: "string" } }, required: ["crop", "location"], additionalProperties: false } },
  get_water_consumption: { description: "Retrieve measured water consumption for a place", parameters: { type: "object", properties: { location: { type: "string" } }, required: ["location"], additionalProperties: false } },
  get_solar_energy_status: { description: "Retrieve solar inverter production and status", parameters: { type: "object", properties: { location: { type: "string" } }, required: ["location"], additionalProperties: false } },
  analyze_resource_demand: { description: "Analyze measured electricity, water, and traffic demand", parameters: { type: "object", properties: { location: { type: "string" } }, required: ["location"], additionalProperties: false } },
};
