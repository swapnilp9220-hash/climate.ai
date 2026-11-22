import { analyzeResourceDemand, getSolarEnergyStatus, getWaterConsumption } from "@/lib/tools";

export const resourceAgent = {
  name: "Smart Resource Agent",
  tools: {
    get_water_consumption: getWaterConsumption,
    get_solar_energy_status: getSolarEnergyStatus,
    analyze_resource_demand: analyzeResourceDemand,
  },
};
