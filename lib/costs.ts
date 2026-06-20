export const COSTS_ARS = {
  // Prices as of March 2026 en ARG (ARS)
  MATERIALS: {
    cemento_50kg: 12000,
    arena_m3: 47200,
    ladrillos_1000u: 222500, // Promedio
    hierro_8mm: 10500,
    piedra_m3: 130000,
    durlock_placa: 18500
  },
  // Estimated base constuction cost per m2 (in ARS)
  ESTIMATED_COST_PER_M2: {
    economic: 850000,
    standard: 1200000,
    premium: 1850000 
  },
  // Multipliers for Total Property Value based on Real Estate market (Land + Value Added)
  ENVIRONMENT_MULTIPLIER: {
    "campo_sierras": 0.9,     // e.g. Sierras de Córdoba (lower land impact)
    "montaña_mendoza": 1.2,   // e.g. Montañas de Mendoza (logistic costs & high demand)
    "ciudad_premium": 3.8     // e.g. Puerto Madero (extreme land value scarcity)
  },
  // Fixed objects base costs
  OBJECTS: {
    pileta_por_m2: 500000 // ARS 500,000 por metro cuadrado de piscina
  },
  // Higher costs for spaces with plumbing/gas/bespoke furniture
  ROOM_TYPE_MULTIPLIER: {
    living: 1.0,
    comedor: 1.0,
    dormitorio: 1.0,
    oficina: 1.1,
    quincho: 1.25,
    cocina: 1.45,
    "baño": 1.65
  },
  EXTRAS_FIXED: {
    garage_unit: 1800000,
    terrace_simple: 850000,
    terrace_pergola: 1200000,
    terrace_rooftop_garden: 2200000,
    garden_cesped: 350000,
    garden_japones: 950000,
    garden_tropical: 1100000,
    garden_zen: 800000
  },
  // Professional Material Estimation Ratios (Per m2 of Built Surface)
  ESTIMATION_RATIOS: {
    concreto_m3_per_m2: 0.12,  // Losa + Vigas + Columnas
    acero_kg_per_m2: 9.5,      // Armadura estructural
    ladrillos_u_per_m2_wall: 18, // Ladrillo hueco 18x18x33
    cemento_bags_per_m2: 0.25, // Bolsas de 50kg para revoques y terminaciones
    arena_m3_per_m2: 0.05,
    pintura_l_per_m2: 0.4      // 2 manos
  },
  // Sustainability & Carbon Footprint Factors (CO2 kg per unit)
  SUSTAINABILITY: {
    co2_per_m3_concrete: 250,  // kg CO2
    co2_per_kg_steel: 1.8,     // kg CO2
    co2_per_brick: 0.45,       // kg CO2
    solar_kwh_per_m2_day: 1.45, // kWh average potential
    trees_offset_per_year: 22   // kg CO2 offset per mature tree
  }
};

/**
 * Calculates a detailed material breakdown for a professional architect's budget.
 */
export function estimateMaterialBreakdown(totalM2: number) {
  const ratios = COSTS_ARS.ESTIMATION_RATIOS;
  const materials = {
    hormigon: totalM2 * ratios.concreto_m3_per_m2,
    acero: totalM2 * ratios.acero_kg_per_m2,
    ladrillos: totalM2 * 2.8 * ratios.ladrillos_u_per_m2_wall,
    cemento: totalM2 * ratios.cemento_bags_per_m2,
    arena: totalM2 * ratios.arena_m3_per_m2,
    pintura: totalM2 * 2.5 * 3 * ratios.pintura_l_per_m2
  };

  const co2 = (materials.hormigon * COSTS_ARS.SUSTAINABILITY.co2_per_m3_concrete) +
              (materials.acero * COSTS_ARS.SUSTAINABILITY.co2_per_kg_steel) +
              (materials.ladrillos * COSTS_ARS.SUSTAINABILITY.co2_per_brick);

  return { ...materials, totalCO2: Math.round(co2) };
}
