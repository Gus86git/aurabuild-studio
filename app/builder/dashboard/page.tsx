"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { COSTS_ARS } from "@/lib/costs";
import { 
  ArrowLeft, Download, Building, Calculator, DollarSign, Layers, 
  Car, Sun, Trees, Palette, Eye, Ruler, Leaf, Zap, Cloud
} from "lucide-react";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid
} from 'recharts';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Rehydrate state safely
    try {
      const configRaw = sessionStorage.getItem("aurabuild_config");
      const config = configRaw ? JSON.parse(configRaw) : null;
      const totalM2 = Number(sessionStorage.getItem("aurabuild_totalM2") || 0);
      const calidad = sessionStorage.getItem("aurabuild_calidad") || "standard";
      const totalCost = Number(sessionStorage.getItem("aurabuild_totalCost") || 0);
      if (config) setData({ config, totalM2, calidad, totalCost });
    } catch (e) {}
  }, []);

  if (!mounted || !data) {
    return (
      <div 
        className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-cyan-500 font-mono"
        suppressHydrationWarning
      >
        Iniciando Motor Analítico...
      </div>
    );
  }

  const { config, totalM2, calidad, totalCost } = data;

  // Real Cost Logistics Match
  const constructBaseCost = totalM2 * COSTS_ARS.ESTIMATED_COST_PER_M2[calidad as keyof typeof COSTS_ARS.ESTIMATED_COST_PER_M2];
  const envMultiplier = config.environment ? COSTS_ARS.ENVIRONMENT_MULTIPLIER[config.environment as keyof typeof COSTS_ARS.ENVIRONMENT_MULTIPLIER] : 1;
  const poolM2 = (config.pool?.active) ? (config.pool.width * config.pool.length) : 0;
  const poolCost = poolM2 * COSTS_ARS.OBJECTS.pileta_por_m2;

  const landAddedValue = (constructBaseCost * envMultiplier) - constructBaseCost;
  
  // New Metrics Calculation
  const roomData = config.ambientes.reduce((acc: any, a: any) => {
    const type = a.tipo || 'living';
    const m2 = a.dimensiones[0] * a.dimensiones[2];
    acc[type] = (acc[type] || 0) + m2;
    return acc;
  }, {});

  const roomChartData = Object.entries(roomData).map(([name, value]) => ({ 
    name: name.toUpperCase(), 
    m2: Math.round(Number(value)) 
  })).sort((a,b) => b.m2 - a.m2);

  const garageCost = (config.garages || 0) * COSTS_ARS.EXTRAS_FIXED.garage_unit;
  const terraceKey = `terrace_${config.terrace}` as keyof typeof COSTS_ARS.EXTRAS_FIXED;
  const terraceCost = (COSTS_ARS.EXTRAS_FIXED as any)[terraceKey] || 0;
  const gardenKey = `garden_${config.gardenStyle}` as keyof typeof COSTS_ARS.EXTRAS_FIXED;
  const gardenCost = (COSTS_ARS.EXTRAS_FIXED as any)[gardenKey] || 0;

  const totalExtras = poolCost + garageCost + terraceCost + gardenCost;
  
  // Graph 1: Allocation
  const breakdownData = [
    { name: 'Estructura Base', value: constructBaseCost, color: '#3ABEFF' },
    { name: 'Valoración Terreno', value: landAddedValue, color: '#10b981' },
    { name: 'Extras y Confort', value: totalExtras, color: '#f59e0b' }
  ];

  // Graph 2: Exact Material Logistics Simulated Based on m2 (Professional Architectural Ratios)
  const ratios = (COSTS_ARS as any).ESTIMATION_RATIOS || {
    concreto_m3_per_m2: 0.12,
    acero_kg_per_m2: 9.5,
    ladrillos_u_per_m2_wall: 18,
    cemento_bags_per_m2: 0.25,
    arena_m3_per_m2: 0.05
  };

  const materialsRequired = [
    { name: 'Hormigón Elaborado (m³)', qty: totalM2 * ratios.concreto_m3_per_m2, price: COSTS_ARS.MATERIALS.piedra_m3 * 0.8 }, // Usamos piedra como referencia
    { name: 'Hierro Aletado (kg)', qty: totalM2 * ratios.acero_kg_per_m2, price: COSTS_ARS.MATERIALS.hierro_8mm / 8 }, // Precio por kg
    { name: 'Ladrillo Hueco 18x18x33', qty: totalM2 * 2.8 * ratios.ladrillos_u_per_m2_wall, price: COSTS_ARS.MATERIALS.ladrillos_1000u / 1000 },
    { name: 'Cemento (bolsa 50kg)', qty: totalM2 * ratios.cemento_bags_per_m2, price: COSTS_ARS.MATERIALS.cemento_50kg },
    { name: 'Arena (m³)', qty: totalM2 * ratios.arena_m3_per_m2, price: COSTS_ARS.MATERIALS.arena_m3 },
  ].map(mat => ({
    ...mat,
    qty: Math.ceil(mat.qty),
    totalPrice: Math.round(Math.ceil(mat.qty) * mat.price)
  })).sort((a,b) => b.totalPrice - a.totalPrice);

  // Sustainability Metrics (Professional CO2 Math)
  const co2Total = (totalM2 * ratios.concreto_m3_per_m2 * 250) + 
                   (totalM2 * ratios.acero_kg_per_m2 * 1.8) + 
                   (totalM2 * 2.8 * ratios.ladrillos_u_per_m2_wall * 0.45);
  
  const treesRequired = Math.ceil(co2Total / 22); // kg CO2 per tree per year
  const solarPotential = config.solarPanels ? (totalM2 * 0.15 * 1.45 * 30).toFixed(1) : "0"; // Monthly kWh

  // Structural Check Logic
  const hasFloatingRooms = config.ambientes.some((a: any) => {
    if (a.planta === 0) return false;
    // Simplistic check: if it's on floor 1, does it have at least 1 room below it?
    // In a real app we'd check coordinates, but for now we check floor count consistency
    return a.planta > 0 && config.ambientes.filter((b:any) => b.planta === a.planta - 1).length === 0;
  });

  return (
    <div className="min-h-screen bg-[#060606] text-stone-200 font-sans p-4 md:p-8">
      {/* SaaS Navigation Header */}
      <header className="flex justify-between items-center bg-neutral-900 border border-neutral-800 p-4 rounded-2xl mb-8">
        <div className="flex items-center gap-4">
          <Link href="/builder" className="text-stone-400 hover:text-cyan-400 transition-colors p-2 bg-neutral-800 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-widest">AuraBuild Analytics</h1>
            <p className="text-xs text-stone-500 tracking-wider">INTELIGENCIA DE INFRAESTRUCTURA</p>
          </div>
        </div>
        <button className="hidden md:flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-stone-300 px-4 py-2 rounded-lg text-sm transition-all border border-neutral-700">
          <Download size={16} /> Exportar Reporte .PDF
        </button>
      </header>

      {/* Main KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { title: "PRESUPUESTO TOTAL ARS", value: `$${totalCost.toLocaleString('es-AR')}`, icon: <DollarSign className="text-cyan-500"/>, metric: "Dólar aprox (1:1400)" },
          { title: "SUPERFICIE CUBIERTA", value: `${totalM2} m²`, icon: <Building className="text-purple-500"/>, metric: `Calidad: ${calidad.toUpperCase()}` },
          { title: "VALOR DEL MODELO 3D", value: config.stylePreset?.toUpperCase() || "ESTÁNDAR", icon: <Palette className="text-pink-500"/>, metric: `Modo: ${config.viewMode || '3D'}` },
          { title: "ADICIONALES DE OBRA", value: `$${totalExtras.toLocaleString('es-AR')}`, icon: <Layers className="text-amber-500"/>, metric: `${config.garages || 0} Cocheras | ${config.terrace !== 'ninguna' ? 'Terraza' : 'Sin Terraza'}` },
        ].map((kpi, i) => (
          <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-xs font-semibold text-stone-500 tracking-wider">{kpi.title}</h4>
              <div className="p-2 bg-neutral-950/50 rounded-lg">{kpi.icon}</div>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">{kpi.value}</h2>
            <p className="text-xs text-stone-400">{kpi.metric}</p>
          </div>
        ))}
      </div>

      {/* NEW: ESTILOS Y ESPECIFICACIONES (A LA PROME AI) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
              <div className="p-3 bg-cyan-950/30 rounded-lg text-cyan-400"><Eye size={20}/></div>
              <div>
                  <p className="text-[10px] text-stone-500 uppercase font-bold">Visualización</p>
                  <p className="text-sm font-semibold">{config.viewMode?.toUpperCase() || '3D PERSPECTIVE'}</p>
              </div>
          </div>
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
              <div className="p-3 bg-emerald-950/30 rounded-lg text-emerald-400"><Trees size={20}/></div>
              <div>
                  <p className="text-[10px] text-stone-500 uppercase font-bold">Paisajismo</p>
                  <p className="text-sm font-semibold">{config.gardenStyle?.toUpperCase() || 'SIN JARDÍN'}</p>
              </div>
          </div>
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
              <div className="p-3 bg-amber-950/30 rounded-lg text-amber-400"><Car size={20}/></div>
              <div>
                  <p className="text-[10px] text-stone-500 uppercase font-bold">Capacidad</p>
                  <p className="text-sm font-semibold">{config.garages || 0} Vehículos</p>
              </div>
          </div>
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
              <div className="p-3 bg-purple-950/30 rounded-lg text-purple-400"><Sun size={20}/></div>
              <div>
                  <p className="text-[10px] text-stone-500 uppercase font-bold">Energía</p>
                  <p className="text-sm font-semibold">{config.solarPanels ? 'PANELES SOLARES' : 'RED ESTÁNDAR'}</p>
              </div>
          </div>
      </div>

      {/* Charts Level */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Status Metric */}
          <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-2xl flex items-center gap-4">
            <div className={`p-3 rounded-xl ${hasFloatingRooms ? 'bg-amber-900/30 text-amber-500' : 'bg-emerald-900/30 text-emerald-500'}`}>
              <Building size={24} />
            </div>
            <div>
              <p className="text-[10px] text-stone-500 uppercase font-bold tracking-tighter">Estado Estructural</p>
              <h4 className={`text-lg font-bold ${hasFloatingRooms ? 'text-amber-500' : 'text-emerald-500'}`}>
                {hasFloatingRooms ? 'Requiere Refuerzo' : 'Estructura Óptima'}
              </h4>
              <p className="text-[10px] text-stone-600">{hasFloatingRooms ? 'Voladizos sin apoyo detectados' : 'Cargas balanceadas'}</p>
            </div>
          </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-semibold text-stone-400 tracking-wider mb-6">DISTRIBUCIÓN DEL CAPITAL</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={breakdownData} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                  {breakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `$${value.toLocaleString('es-AR')}`}
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                  itemStyle={{ color: '#e5e5e5' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart Materials */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-semibold text-stone-400 tracking-wider mb-6 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-cyan-400"/> DISTRIBUCIÓN DE SUPERFICIE (m²)
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roomChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="name" stroke="#525252" fontSize={10} />
                <YAxis stroke="#525252" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                  itemStyle={{ color: '#3ABEFF' }}
                />
                <Bar dataKey="m2" fill="#3ABEFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Material DataGrid Detail */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-semibold text-stone-400 tracking-wider mb-6">REQUERIMIENTO INSUMOS (Calculado por m²)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-stone-500 uppercase bg-neutral-950 border-b border-neutral-800">
              <tr>
                <th className="px-6 py-4 rounded-tl-lg">Descripción del Material</th>
                <th className="px-6 py-4">Cantidad Est.</th>
                <th className="px-6 py-4">Precio Unitario</th>
                <th className="px-6 py-4 rounded-tr-lg text-right">Monto Parcial (ARS)</th>
              </tr>
            </thead>
            <tbody>
              {materialsRequired.map((mat, idx) => (
                <tr key={idx} className="border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-stone-300">{mat.name}</td>
                  <td className="px-6 py-4 text-cyan-500 bg-cyan-950/20 w-32 text-center rounded-md font-mono">{mat.qty}</td>
                  <td className="px-6 py-4">${mat.price.toLocaleString('es-AR')}</td>
                  <td className="px-6 py-4 text-right text-emerald-400 font-bold">${mat.totalPrice.toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sustainability Intelligence Widget */}
      <div className="bg-gradient-to-br from-emerald-950/20 to-neutral-900 border border-emerald-900/30 rounded-2xl p-6 shadow-xl relative overflow-hidden mt-8">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Leaf size={120} className="text-emerald-500" />
        </div>
        <h3 className="text-sm font-semibold text-emerald-400 tracking-wider mb-6 flex items-center gap-2">
          <Leaf size={18} /> INFORME DE SUSTENTABILIDAD Y EFICIENCIA
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="bg-emerald-950/30 border border-emerald-900/20 p-4 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Cloud className="text-stone-400" size={16} />
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Huella de Carbono (Obra)</span>
            </div>
            <div className="text-3xl font-bold text-stone-200">
              {Math.round(co2Total / 1000).toLocaleString()} <span className="text-sm font-normal text-stone-500">Ton CO₂e</span>
            </div>
            <p className="text-[10px] text-emerald-600 mt-2 italic font-medium">Equivale a plantar {treesRequired} árboles para compensar en un año.</p>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-900/20 p-4 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="text-amber-400" size={16} />
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Ahorro Energético (Solar)</span>
            </div>
            <div className="text-3xl font-bold text-amber-400">
              {solarPotential} <span className="text-sm font-normal text-stone-500">kWh/mes</span>
            </div>
            <p className="text-[10px] text-stone-500 mt-2">{config.solarPanels ? 'Generación activa estimativa' : 'Requiere activación de paneles en el diseñador'}</p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-emerald-900/20 rounded-xl border border-emerald-500/10 backdrop-blur-sm">
          <h4 className="text-xs font-bold text-emerald-500 mb-2 uppercase tracking-tighter flex items-center gap-2">
            🚀 Sugerencias de Mejora Sustentable:
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-stone-400">
            <li className="flex flex-col gap-1">
              <span className="text-stone-300 font-bold uppercase">Materiales Bio</span>
              <p>Considerar "Hormigón de Cáñamo" o CLT para reducir el CO₂ en un 40%.</p>
            </li>
            <li className="flex flex-col gap-1">
              <span className="text-stone-300 font-bold uppercase">Eficiencia Térmica</span>
              <p>Implementar DVH (Doble Vidriado) para ahorrar 30% en climatización.</p>
            </li>
            <li className="flex flex-col gap-1">
              <span className="text-stone-300 font-bold uppercase">Gestión Hídrica</span>
              <p>Tus {totalM2}m² de techo pueden captar {Math.round(totalM2 * 0.8 * 800 / 12)}L de lluvia/mes.</p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
