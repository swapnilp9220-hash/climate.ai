import { analyzeCropConditions, estimateCropYield, getMandiPrices, getSoilInformation } from "@/lib/tools";

export const agricultureAgent = {
  name: "Agriculture Agent",
  tools: {
    get_soil_information: getSoilInformation,
    get_mandi_prices: getMandiPrices,
    analyze_crop_conditions: analyzeCropConditions,
    estimate_crop_yield: estimateCropYield,
  },
};
