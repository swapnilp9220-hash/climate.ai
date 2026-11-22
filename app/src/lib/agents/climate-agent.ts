import { getWeather, predictClimateRisk } from "@/lib/tools";

export const climateAgent = {
  name: "Climate Agent",
  tools: { get_weather: getWeather, predict_climate_risk: predictClimateRisk },
};
