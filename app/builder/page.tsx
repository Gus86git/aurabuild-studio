"use client";
import CasaBuilder, { CasaBuilderConfig } from "@/components/CasaBuilder";
import type { Distribucion } from "@/components/CasaBuilder";
import { useState, useEffect, useRef } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  HelpCircle, Plus, Trash2, Home, Triangle, PanelTop,
  Bed, Utensils, Sofa, Bath, Briefcase, Flame, Coffee, Shapes,
  Layout, Box, Camera, Pencil, Eye, Palette, Layers
} from "lucide-react";
import React from "react";
import Link from "next/link";
import { COSTS_ARS } from "@/lib/costs";

// Hook para detectar dispositivos móviles
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 768 || 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

const WALL_TEXTURES = [
  'Bricks059_1K-JPG_Color.jpg',
  'Bricks066_1K-JPG_Color.jpg',
  'texture_marble.png',
  'texture_wood.png',
  'wall_wood_mosaic.png',
  'wall_stone_cladding.png',
  'wall_wood_slats_premium.png',
  'wall_black_slats.svg'
];
const FLOOR_TEXTURES = [
  'WoodFloor064_1K-JPG_Color.jpg',
  'WoodFloor019_1K-JPG_Color.jpg',
  'texture_wood.png',
  'texture_marble.png'
];
const ROOM_TYPES = [
  { id: 'living', label: 'Living', icon: Sofa, defaultSup: 20 },
  { id: 'cocina', label: 'Cocina', icon: Utensils, defaultSup: 12 },
  { id: 'dormitorio', label: 'Dormitorio', icon: Bed, defaultSup: 12 },
  { id: 'baño', label: 'Baño', icon: Bath, defaultSup: 5 },
  { id: 'comedor', label: 'Comedor', icon: Coffee, defaultSup: 15 },
  { id: 'oficina', label: 'Oficina', icon: Briefcase, defaultSup: 10 },
] as const;

const STYLE_PRESETS = [
  { id: 'standard', label: 'Estándar', wall: 'Bricks059_1K-JPG_Color.jpg', floor: 'WoodFloor064_1K-JPG_Color.jpg' },
  { id: 'modern', label: 'Moderno', wall: 'texture_marble.png', floor: 'texture_marble.png' },
  { id: 'industrial', label: 'Industrial', wall: 'Bricks066_1K-JPG_Color.jpg', floor: 'WoodFloor019_1K-JPG_Color.jpg' },
  { id: 'scandinavian', label: 'Escandinavo', wall: 'texture_wood.png', floor: 'WoodFloor019_1K-JPG_Color.jpg' },
] as const;

function initialConfig(): CasaBuilderConfig {
  return {
    plantas: 1,
    distribuciones: ["fila"],
    ambientes: [
      { origen: [0, 0, 0], dimensiones: [Math.sqrt(20), 2.5, Math.sqrt(20)], planta: 0, tipo: 'living' },
      { origen: [0, 0, 0], dimensiones: [Math.sqrt(12), 2.5, Math.sqrt(12)], planta: 0, tipo: 'cocina' },
    ],
    wallTexture: WALL_TEXTURES[0],
    floorTexture: FLOOR_TEXTURES[0],
    roofTexture: 'RoofingTiles014A_1K-JPG_Color.jpg',
    wallColor: "#dddddd", // deprecado
    roofColor: "#aa0000", // deprecado
    objectColor: "#333399",
    roofType: "flat",
    solarPanels: false,
    pool: { active: false, width: 8, length: 4 },
    environment: "ciudad_premium",
    garages: 0,
    doorStyle: "moderna",
    windowStyle: "simple",
    gardenStyle: "ninguno",
    terrace: "ninguna",
    viewMode: "perspective",
  };
}

function getDistribucionOptions(ambientesEnPlanta: number) {
  const options = [
    { value: "fila", label: "En fila" },
    { value: "cuadricula", label: "En cuadrícula" },
  ];
  if (ambientesEnPlanta >= 3) options.push({ value: "l", label: "En L" });
  if (ambientesEnPlanta >= 4) options.push({ value: "u", label: "En U" });
  return options;
}

// Calcula el área cubierta por la base (planta 0)
function getBaseBounds(ambientes: {planta: number, origen: number[], dimensiones: number[]}[]): { minX: number, maxX: number, minZ: number, maxZ: number } {
  const base = ambientes.filter((a) => a.planta === 0);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  base.forEach((a) => {
    minX = Math.min(minX, a.origen[0]);
    maxX = Math.max(maxX, a.origen[0] + a.dimensiones[0]);
    minZ = Math.min(minZ, a.origen[2]);
    maxZ = Math.max(maxZ, a.origen[2] + a.dimensiones[2]);
  });
  return { minX, maxX, minZ, maxZ };
}

// Verifica si un ambiente está completamente apoyado sobre la base
function isSupported(
  amb: {planta: number, origen: number[], dimensiones: number[]},
  ambientes: {planta: number, origen: number[], dimensiones: number[]}[]
): boolean {
  if (amb.planta === 0) return true;
  const { minX, maxX, minZ, maxZ } = getBaseBounds(ambientes);
  const x0 = amb.origen[0], x1 = amb.origen[0] + amb.dimensiones[0];
  const z0 = amb.origen[2], z1 = amb.origen[2] + amb.dimensiones[2];
  return x0 >= minX && x1 <= maxX && z0 >= minZ && z1 <= maxZ;
}

export default function BuilderPage() {
  const [config, setConfig] = useState<CasaBuilderConfig>(initialConfig());
  const [openPlantas, setOpenPlantas] = useState<string[]>(['0']);
  const [activeAmbienteTab, setActiveAmbienteTab] = useState<Record<number, string>>({});
  const prevAmbientesCount = useRef<Record<number, number>>({});
  const isMobile = useIsMobile();
  const [activePlantaTab, setActivePlantaTab] = useState('0');
  const [wireframeMode, setWireframeMode] = useState(false);
  const [openSection, setOpenSection] = useState<string[]>(["plantas", "ambientes", "colores"]);
  const [calidad, setCalidad] = useState<keyof typeof COSTS_ARS.ESTIMATED_COST_PER_M2>("standard");

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const savedConfig = sessionStorage.getItem("aurabuild_config");
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
      } catch (e) {
        console.error("Error rehydrating config:", e);
      }
    }
  }, []);

  // Sincronizar openPlantas con la cantidad de plantas
  useEffect(() => {
    setOpenPlantas(prev => {
      const all = Array.from({ length: config.plantas }, (_, i) => String(i));
      if (prev.length < all.length) {
        return all;
      }
      const filtered = prev.filter(v => Number(v) < config.plantas);
      if (filtered.length !== prev.length) return filtered;
      return prev;
    });
  }, [config.plantas]);

  useEffect(() => {
    const newCounts: Record<number, number> = {};
    const newActiveTabs = { ...activeAmbienteTab };
    let changed = false;

    for (let i = 0; i < config.plantas; i++) {
      const count = config.ambientes.filter(a => a.planta === i).length;
      newCounts[i] = count;

      // Si se agregó un nuevo ambiente, activarlo
      if ((prevAmbientesCount.current[i] || 0) < count) {
        newActiveTabs[i] = `ambiente-${i}-${count - 1}`;
        changed = true;
      }

      // Si la pestaña activa ya no existe (por eliminación), ajustarla
      const activeForFloor = newActiveTabs[i];
      if (activeForFloor) {
        const activeIndex = parseInt(activeForFloor.split('-')[2], 10);
        if (activeIndex >= count && count > 0) {
          newActiveTabs[i] = `ambiente-${i}-${count - 1}`;
          changed = true;
        } else if (count === 0) {
            delete newActiveTabs[i];
            changed = true;
        }
      } else if (count > 0) {
        newActiveTabs[i] = `ambiente-${i}-0`;
        changed = true;
      }
    }

    if (changed) {
      setActiveAmbienteTab(newActiveTabs);
    }
    prevAmbientesCount.current = newCounts;
  }, [config.ambientes, config.plantas, activeAmbienteTab]);

  if (!mounted) return null;

  const handleCapture = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const dataURL = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `aurabuild-render-${new Date().getTime()}.png`;
      link.href = dataURL;
      link.click();
    }
  };

  const handleExportGLB = async () => {
    try {
      const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      // Get the scene from the Three.js renderer
      const renderer = (canvas as any).__renderer || (canvas as any)._renderer;
      // Fallback: export a notification
      alert('Para exportar GLB, la escena debe estar activa. Intenta después del primer render.');
    } catch (e) {
      alert('Exportación GLB disponible próximamente.');
    }
  };

  // Manejo de plantas y distribuciones
  const handlePlantasChange = (n: number) => {
    setConfig(cfg => ({
      ...cfg,
      plantas: n,
      distribuciones: n > cfg.distribuciones.length
        ? [...cfg.distribuciones, ...Array(n - cfg.distribuciones.length).fill("fila")]
        : cfg.distribuciones.slice(0, n),
      ambientes: cfg.ambientes.map(a => ({ ...a, planta: Math.min(a.planta, n - 1) }))
    }));
  };


  const toggleSection = (s: string) => setOpenSection(o => o.includes(s) ? o.filter(x => x !== s) : [...o, s]);

  const addPlanta = () => {
    if (config.plantas < 4) {
      setConfig(cfg => {
        const n = cfg.plantas + 1;
        return {
          ...cfg,
          plantas: n,
          ambientes: [...cfg.ambientes, { origen: [0, 0, 0], dimensiones: [Math.sqrt(12), 2.5, Math.sqrt(12)], planta: n - 1, wallColor: '#b0b0b0' }],
          distribuciones: [...cfg.distribuciones, "fila"]
        };
      });
      setActivePlantaTab(String(config.plantas));
    }
  };

  const removePlanta = (pidx: number) => {
    if (config.plantas > 1) {
        setConfig(cfg => {
            const n = cfg.plantas - 1;
            const newAmbientes = cfg.ambientes
                .filter(a => a.planta !== pidx)
                .map(a => (a.planta > pidx ? { ...a, planta: a.planta - 1 } : a));
            const newDistribuciones = cfg.distribuciones.filter((_, i) => i !== pidx);

            return {
                ...cfg,
                plantas: n,
                ambientes: newAmbientes,
                distribuciones: newDistribuciones,
            };
        });
        setActivePlantaTab(String(Math.max(0, pidx - 1)));
    }
  };

  function PlantaControls({ pidx }: { pidx: number }) {
    const ambientesEnPlanta = config.ambientes.filter(a => a.planta === pidx);
    const options = getDistribucionOptions(ambientesEnPlanta.length);
    const current = options.find(o => o.value === config.distribuciones[pidx]) ? config.distribuciones[pidx] : (options[0]?.value || 'fila');
    
    // Solo mostrar selector de techo en la planta superior
    const isPlantaSuperior = pidx === config.plantas - 1;
    return (
      <>
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm font-medium text-stone-300 shrink-0">Distribución:</label>
          <Select value={current} onValueChange={val => setConfig(cfg => ({ ...cfg, distribuciones: cfg.distribuciones.map((v, i) => i === pidx ? (val as Distribucion) : v) }))}>
            <SelectTrigger className="w-full mt-1 h-9 bg-neutral-900 border-neutral-700 text-stone-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-neutral-700">
              {options.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-stone-300 focus:bg-neutral-800">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isPlantaSuperior && (
          <div className="flex items-center gap-2 mb-4 p-2 bg-neutral-900 border border-neutral-800 rounded-lg">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider mr-1">Techo:</span>
            <button
              className={`p-2 rounded-lg transition-all ${config.roofType === 'flat' ? 'bg-cyan-900/50 border border-cyan-600 text-cyan-400' : 'bg-neutral-800 border border-neutral-700 text-stone-400 hover:text-stone-200'}`}
              title="Techo plano"
              onClick={() => setConfig(cfg => ({ ...cfg, roofType: 'flat' }))}
              type="button"
            >
              <Home className="w-4 h-4" />
            </button>
            <button
              className={`p-2 rounded-lg transition-all ${config.roofType === 'gable' ? 'bg-cyan-900/50 border border-cyan-600 text-cyan-400' : 'bg-neutral-800 border border-neutral-700 text-stone-400 hover:text-stone-200'}`}
              title="Techo a dos aguas"
              onClick={() => setConfig(cfg => ({ ...cfg, roofType: 'gable' }))}
              type="button"
            >
              <Triangle className="w-4 h-4" />
            </button>
            <button
              className={`p-2 rounded-lg transition-all ${config.solarPanels ? 'bg-cyan-900/50 border border-cyan-600 text-cyan-400' : 'bg-neutral-800 border border-neutral-700 text-stone-400 hover:text-stone-200'}`}
              title="Paneles solares"
              onClick={() => setConfig(cfg => ({ ...cfg, solarPanels: !cfg.solarPanels }))}
              type="button"
            >
              <PanelTop className="w-4 h-4" />
            </button>
          </div>
        )}

          <Tabs
          value={activeAmbienteTab[pidx] || ''}
          onValueChange={(value) => setActiveAmbienteTab(prev => ({ ...prev, [pidx]: value }))}
          className="w-full"
        >
          <div className="flex items-center gap-1">
            <TabsList className="flex-grow bg-neutral-900 border border-neutral-800">
              {ambientesEnPlanta.map((amb, idx) => {
                const typeData = ROOM_TYPES.find(t => t.id === amb.tipo) || ROOM_TYPES[0];
                const Icon = typeData.icon;
                return (
                  <TabsTrigger key={idx} value={`ambiente-${pidx}-${idx}`} className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-stone-400">
                    <Icon className="w-4 h-4 mr-1" />
                    {ambientesEnPlanta.length > 3 ? '' : idx + 1}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <Button
              variant="outline"
              className="px-2 h-9 bg-cyan-600 hover:bg-cyan-500 text-white font-bold border-cyan-500"
              onClick={() => {
                setConfig(cfg => ({
                  ...cfg,
                  ambientes: [...cfg.ambientes, {
                    origen: [0,0,0],
                    dimensiones: [Math.sqrt(12), 2.5, Math.sqrt(12)],
                    planta: pidx,
                    tipo: 'dormitorio',
                    wallColor: '#b0b0b0'
                  }]
                }));
              }}
            >
              <Plus className="h-4 w-4"/>
            </Button>
          </div>

          {ambientesEnPlanta.map((amb, idx) => {
            return (
              <TabsContent key={idx} value={`ambiente-${pidx}-${idx}`} className="mt-2">
                <div className="border border-neutral-800 rounded-xl p-3 bg-neutral-900/80 shadow-sm">
                  <div className="flex gap-2 items-center mb-3">
                    <div className="flex items-center gap-2">
                       {(() => {
                         const typeIcon = ROOM_TYPES.find(t => t.id === amb.tipo)?.icon || Shapes;
                         const Icon = typeIcon;
                         return <Icon className="w-5 h-5 text-cyan-400" />;
                       })()}
                       <span className="font-semibold text-base text-stone-200 uppercase tracking-tight">
                         {ROOM_TYPES.find(t => t.id === amb.tipo)?.label || 'Ambiente'}
                       </span>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="ml-auto w-8 h-8 bg-red-900/50 hover:bg-red-800 text-red-400 border border-red-900"
                      onClick={() => setConfig(cfg => ({ ...cfg, ambientes: cfg.ambientes.filter(a2 => a2 !== amb) }))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="mb-4">
                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1 block">Tipo de Habitación</label>
                    <div className="grid grid-cols-4 gap-1">
                      {ROOM_TYPES.map(type => {
                        const TIcon = type.icon;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => {
                              const lado = Math.sqrt(type.defaultSup);
                              setConfig(cfg => ({
                                ...cfg,
                                ambientes: cfg.ambientes.map(am => am === amb ? { 
                                  ...am, 
                                  tipo: type.id as any,
                                  dimensiones: [lado, am.dimensiones[1], lado]
                                } : am)
                              }));
                            }}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                              amb.tipo === type.id 
                                ? 'bg-cyan-950 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]' 
                                : 'bg-neutral-800 border-neutral-700 text-stone-500 hover:border-neutral-600 hover:text-stone-300'
                            }`}
                            title={type.label}
                          >
                            <TIcon className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-center">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-stone-500 uppercase tracking-wider truncate">Sup. (m²)</label>
                      <Input
                        type="number"
                        min={1}
                        value={Math.round(amb.dimensiones[0] * amb.dimensiones[2])}
                        onChange={e => {
                          const superficie = Math.max(1, Number(e.target.value));
                          const lado = Math.sqrt(superficie);
                          setConfig(cfg => ({
                            ...cfg,
                            ambientes: cfg.ambientes.map((am) => am === amb ? { ...am, dimensiones: [lado, am.dimensiones[1], lado] } : am)
                          }));
                        }}
                        className="w-full h-9 bg-neutral-800 border-neutral-700 text-stone-200"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">Altura (m)</label>
                      <Input
                        type="number"
                        min={2} max={5} step={0.1}
                        value={amb.dimensiones[1]}
                        onChange={e => {
                          const altura = Math.max(2, Math.min(5, Number(e.target.value)));
                          setConfig(cfg => ({ ...cfg, ambientes: cfg.ambientes.map((am) => am === amb ? { ...am, dimensiones: [am.dimensiones[0], altura, am.dimensiones[2]] } : am) }));
                        }}
                        className="w-full h-9 bg-neutral-800 border-neutral-700 text-stone-200"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">Color</label>
                      <input
                        type="color"
                        value={amb.wallColor || '#b0b0b0'}
                        onChange={e => setConfig(cfg => ({ ...cfg, ambientes: cfg.ambientes.map((am) => am === amb ? { ...am, wallColor: e.target.value } : am) }))}
                        className="w-full h-9 p-1 border border-neutral-700 rounded-md bg-neutral-800"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            );
          })}
           {ambientesEnPlanta.length === 0 && (
            <div className="text-center text-stone-500 text-sm p-4 mt-2 border-dashed border-2 border-neutral-800 rounded-xl">
              No hay habitaciones en esta planta.<br/>
              Usa <span className="text-cyan-500 font-bold">+</span> para agregar una.
            </div>
          )}
        </Tabs>
        
        {isMobile && config.plantas > 1 && (
            <div className="mt-4">
                <Button size="sm" variant="destructive" className="w-full" onClick={() => removePlanta(pidx)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar Planta {pidx + 1}
                </Button>
            </div>
        )}
      </>
    );
  }

  // Desktop-only controls for number of floors
  const DesktopPlantaCounter = () => (
    <div className="flex items-center gap-2">
      <label className="text-sm font-semibold text-stone-400 uppercase tracking-wider mr-2">Plantas:</label>
      <div className="flex rounded-lg border border-neutral-700 bg-neutral-900 overflow-hidden">
        <button
          className="px-3 py-2 text-lg text-stone-400 hover:bg-neutral-800 hover:text-red-400 transition disabled:opacity-30"
          onClick={() => removePlanta(config.plantas - 1)}
          disabled={config.plantas <= 1}
        >-</button>
        <input
          type="number"
          readOnly
          value={config.plantas}
          className="w-12 text-center border-0 bg-transparent focus:ring-0 focus:outline-none text-stone-200 font-bold"
        />
        <button
          className="px-3 py-2 text-lg text-cyan-400 hover:bg-neutral-800 hover:text-cyan-300 transition disabled:opacity-30"
          onClick={addPlanta}
          disabled={config.plantas >= 4}
        >+</button>
      </div>
    </div>
  );
  
  const totalM2 = Math.round(config.ambientes.reduce((acc, a) => acc + (a.dimensiones[0] * a.dimensiones[2]), 0));
  const envMultiplier = config.environment ? COSTS_ARS.ENVIRONMENT_MULTIPLIER[config.environment] : 1;
  const poolM2 = (config.pool?.active) ? (config.pool.width * config.pool.length) : 0;
  const poolCost = poolM2 * COSTS_ARS.OBJECTS.pileta_por_m2;
  
  // Calculate specific room multipliers
  const roomWeightedM2 = config.ambientes.reduce((acc, a) => {
    const sup = a.dimensiones[0] * a.dimensiones[2];
    const mult = (COSTS_ARS as any).ROOM_TYPE_MULTIPLIER[a.tipo || 'living'] || 1.0;
    return acc + (sup * mult);
  }, 0);

  const baseCostPerM2 = COSTS_ARS.ESTIMATED_COST_PER_M2[calidad];
  const totalCost = (roomWeightedM2 * baseCostPerM2 * envMultiplier) + poolCost;

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-[#060606] overflow-hidden" suppressHydrationWarning>
      <aside className="w-full md:w-96 md:h-full p-3 md:p-6 bg-neutral-950 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col gap-3 md:gap-4 shadow-2xl overflow-y-auto no-scrollbar" style={{ maxHeight: isMobile ? '42vh' : '100vh' }}>
        <div className="flex items-center gap-3">
           <Link href="/" passHref>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-stone-400 hover:text-cyan-400 hover:bg-neutral-800 border border-neutral-800">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              </Button>
           </Link>
           <h2 className="font-bold text-lg md:text-2xl bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-widest">Diseñador 3D</h2>
        </div>

        {!isMobile && (
          <div className="bg-cyan-950/30 border border-cyan-900/50 rounded-xl p-4 text-sm mb-2">
              <p className="text-xs font-semibold text-cyan-500 uppercase tracking-wider mb-2">Guía Rápida</p>
              <span className="block text-stone-400 mb-1">1. <span className="text-stone-300 font-medium">Estructura:</span> Define plantas y ambientes.</span>
              <span className="block text-stone-400 mb-1">2. <span className="text-stone-300 font-medium">Estilo:</span> Selecciona texturas y aberturas.</span>
              <span className="block text-stone-400 mb-1">3. <span className="text-stone-300 font-medium">Extras:</span> Agrega cocheras, jardín y pileta.</span>
          </div>
        )}

        {/* 0. VISUALIZACIÓN TÉCNICA */}
        <div className="flex flex-col gap-2 p-3 bg-cyan-950/10 rounded-xl border border-cyan-900/30 mb-2">
          <label className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest flex items-center gap-2">
            <Eye className="w-3 h-3" /> Visualización Técnica
          </label>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'perspective', label: '3D', icon: Box },
              { id: 'floorplan', label: 'Plano', icon: Layout },
              { id: 'blueprint', label: 'Blue', icon: Shapes },
              { id: 'sketch', label: 'Boceto', icon: Pencil },
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setConfig(cfg => ({ ...cfg, viewMode: mode.id as any }))}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                  (config.viewMode || 'perspective') === mode.id 
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-400' 
                    : 'bg-neutral-800 border-neutral-700 text-stone-500 hover:text-stone-300'
                }`}
                title={mode.label}
              >
                <mode.icon className="w-4 h-4 mb-1" />
                <span className="text-[9px] font-bold uppercase">{mode.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1 pt-2 border-t border-neutral-800/50">
             <input 
              type="checkbox" id="wireframe-sidebar"
              checked={wireframeMode}
              onChange={(e) => setWireframeMode(e.target.checked)}
              className="w-3 h-3 accent-cyan-500"
             />
             <label htmlFor="wireframe-sidebar" className="text-[10px] font-bold text-stone-400 cursor-pointer uppercase">Activar Estructura Alámbrica</label>
          </div>
        </div>

        {/* 1. FACTURACIÓN Y ENTORNO */}
        <div className="flex flex-col gap-4 p-4 bg-cyan-950/10 rounded-xl border border-cyan-900/30 mb-2">
          <label className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">1. Facturación y Entorno</label>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-stone-500 uppercase">Zona Geográfica</label>
            <Select value={config.environment} onValueChange={(val: any) => setConfig(c => ({...c, environment: val}))}>
              <SelectTrigger className="h-8 bg-neutral-900 border-neutral-700 text-stone-300 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-700 text-stone-300 text-xs">
                <SelectItem value="campo_sierras">Campo / Sierras</SelectItem>
                <SelectItem value="montaña_mendoza">Montañas (Mendoza)</SelectItem>
                <SelectItem value="ciudad_premium">Urbano Premium (Ej: Pto. Madero)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-stone-500 uppercase">Calidad de Obra</label>
            <Select value={calidad} onValueChange={(val: any) => setCalidad(val)}>
              <SelectTrigger className="h-8 bg-neutral-900 border-neutral-700 text-stone-300 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-700 text-stone-300 text-xs">
                <SelectItem value="economic">Económica</SelectItem>
                <SelectItem value="standard">Estándar</SelectItem>
                <SelectItem value="premium">Premium Luxury</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 2. TERRENO TOTAL */}
        <div className="flex flex-col gap-4 p-4 bg-cyan-950/10 rounded-xl border border-cyan-900/30 mb-2">
          <label className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">2. Terreno Total (M²)</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">Ancho (m)</label>
              <Input 
                type="number" min={5} 
                value={config.lote?.width || 20} 
                onChange={e => setConfig(c => ({...c, lote: {...(c.lote || {width:20, length:30}), width: Math.max(5, Number(e.target.value))}}))} 
                className="h-8 bg-neutral-900 border-neutral-700 text-stone-200"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">Largo (m)</label>
              <Input 
                type="number" min={10} 
                value={config.lote?.length || 30} 
                onChange={e => setConfig(c => ({...c, lote: {...(c.lote || {width:20, length:30}), length: Math.max(10, Number(e.target.value))}}))} 
                className="h-8 bg-neutral-900 border-neutral-700 text-stone-200"
              />
            </div>
          </div>
        </div>

        {/* 3. ESTRUCTURA BÁSICA */}
        <div className="flex flex-col gap-4 p-4 bg-cyan-950/10 rounded-xl border border-cyan-900/30 mb-2">
          <label className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">3. Estructura y Plantas</label>
          <DesktopPlantaCounter />
        </div>

        {/* 4. DISEÑO DE INTERIORES */}
        <div className="flex flex-col gap-4 p-4 bg-cyan-950/10 rounded-xl border border-cyan-900/30 mb-2">
          <label className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">4. Distribución de Ambientes</label>
          {isMobile ? (
            <Tabs value={activePlantaTab} onValueChange={setActivePlantaTab} className="w-full">
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${config.plantas < 4 ? config.plantas + 1 : 4}, 1fr)` }}>
                {Array.from({ length: config.plantas }).map((_, pidx) => (
                  <TabsTrigger key={pidx} value={String(pidx)}>P.{pidx + 1}</TabsTrigger>
                ))}
                {config.plantas < 4 && (
                  <Button variant="ghost" className="h-full w-full rounded-md" onClick={addPlanta}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </TabsList>
              {Array.from({ length: config.plantas }).map((_, pidx) => (
                <TabsContent key={pidx} value={String(pidx)} className="mt-2">
                  <PlantaControls pidx={pidx} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <Accordion type="multiple" value={openPlantas} onValueChange={setOpenPlantas} className="w-full">
              {Array.from({ length: config.plantas }).map((_, pidx) => (
                <AccordionItem key={pidx} value={String(pidx)} className="border-neutral-800">
                  <AccordionTrigger className="hover:no-underline py-2">
                    <span className="font-semibold text-sm text-stone-300">Nivel {pidx + 1}</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <PlantaControls pidx={pidx} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        {/* 5. ESTILO ARQUITECTÓNICO */}
        <div className="flex flex-col gap-4 p-4 bg-cyan-950/10 rounded-xl border border-cyan-900/30 mb-2">
          <label className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">5. Estética y Acabados</label>
          
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold text-purple-400 uppercase flex items-center gap-2">
              <Palette className="w-3 h-3" /> Presets de Estilo AI
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setConfig(cfg => ({ 
                    ...cfg, 
                    stylePreset: preset.id as any,
                    wallTexture: preset.wall,
                    floorTexture: preset.floor
                  }))}
                  className={`px-3 py-2 rounded-lg border text-[10px] font-bold transition-all uppercase ${
                    config.stylePreset === preset.id 
                      ? 'bg-purple-900/30 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                      : 'bg-neutral-800 border-neutral-700 text-stone-500 hover:bg-neutral-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-semibold text-stone-500 uppercase">Paredes</label>
              <div className="grid grid-cols-4 gap-1">
                {WALL_TEXTURES.map(tex => (
                  <button
                    key={tex}
                    className={`border-2 rounded-md p-0.5 transition-all ${config.wallTexture === tex ? 'border-cyan-500' : 'border-neutral-800'}`}
                    onClick={() => setConfig(cfg => ({ ...cfg, wallTexture: tex }))}
                    title={tex}
                  >
                    <img src={`/${tex}`} alt={tex} className="w-full h-8 object-cover rounded" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-semibold text-stone-500 uppercase">Suelos</label>
              <div className="grid grid-cols-2 gap-1">
                {FLOOR_TEXTURES.map(tex => (
                  <button
                    key={tex}
                    className={`border-2 rounded-md p-0.5 transition-all ${config.floorTexture === tex ? 'border-cyan-500' : 'border-neutral-800'}`}
                    onClick={() => setConfig(cfg => ({ ...cfg, floorTexture: tex }))}
                  >
                    <img src={`/${tex}`} alt={tex} className="w-full h-8 object-cover rounded" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-stone-500 uppercase">Ventanas</label>
              <Select value={config.windowStyle || 'simple'} onValueChange={(val: any) => setConfig(c => ({...c, windowStyle: val}))}>
                <SelectTrigger className="h-8 bg-neutral-800 border-neutral-700 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-700 text-[10px]">
                  <SelectItem value="simple">Estándar</SelectItem>
                  <SelectItem value="panoramica">Panorámica</SelectItem>
                  <SelectItem value="arco">Arco Colonial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-stone-500 uppercase">Puertas</label>
              <Select value={config.doorStyle || 'moderna'} onValueChange={(val: any) => setConfig(c => ({...c, doorStyle: val}))}>
                <SelectTrigger className="h-8 bg-neutral-800 border-neutral-700 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-700 text-[10px]">
                  <SelectItem value="moderna">Moderna (Negra c/ vidrio)</SelectItem>
                  <SelectItem value="madera_vidrio">Madera y Vidrio</SelectItem>
                  <SelectItem value="colonial">Clásica (Azul arco)</SelectItem>
                  <SelectItem value="minimalista">Minimalista (Lisa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 6. ADICIONALES Y EXTERIORES */}
        <div className="flex flex-col gap-4 p-4 bg-cyan-950/10 rounded-xl border border-cyan-900/30 mb-20">
          <label className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">6. Confort y Exteriores</label>
          
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold text-stone-500 uppercase">Garage</label>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setConfig(c => ({...c, garages: n}))}
                  className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${
                    config.garages === n ? 'bg-cyan-600 border-cyan-400' : 'bg-neutral-800 border-neutral-700 text-stone-500'
                  }`}
                >
                  {n === 0 ? 'Sin Garage' : `${n} Cochera${n > 1 ? 's' : ''}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold text-stone-500 uppercase">Quincho (Semi-abierto)</label>
            <div className="flex gap-1">
              {[
                { val: false, label: 'Sin Quincho' },
                { val: true, label: 'Con Quincho y Parrilla' },
              ].map(opt => (
                <button
                  key={String(opt.val)}
                  onClick={() => setConfig(c => ({...c, quincho: { active: opt.val, width: 6, length: 4 }}))}
                  className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${
                    config.quincho?.active === opt.val ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-neutral-800 border-neutral-700 text-stone-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold text-stone-500 uppercase">Paisajismo</label>
            <div className="grid grid-cols-3 gap-1">
              {([
                { val: 'ninguno', label: '❌' },
                { val: 'cesped', label: '🌿' },
                { val: 'japones', label: '🌸' },
                { val: 'tropical', label: '🌴' },
                { val: 'zen', label: '🧘' },
              ] as const).map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setConfig(c => ({...c, gardenStyle: val}))}
                  className={`py-1 rounded border text-sm transition-all ${
                    config.gardenStyle === val ? 'bg-emerald-700 border-emerald-400' : 'bg-neutral-800 border-neutral-700'
                  }`}
                  title={val}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold text-stone-500 uppercase">Terraza / Rooftop</label>
            <div className="grid grid-cols-2 gap-1">
              {([
                { val: 'ninguna', label: 'Sin Terraza' },
                { val: 'simple', label: 'Simple' },
                { val: 'pergola', label: 'Pérgola' },
                { val: 'rooftop_garden', label: 'Jardín' },
              ] as const).map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setConfig(c => ({...c, terrace: val}))}
                  className={`py-1 rounded text-[10px] font-bold border transition-all ${
                    config.terrace === val ? 'bg-purple-700 border-purple-400' : 'bg-neutral-800 border-neutral-700 text-stone-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 p-3 bg-neutral-900/50 rounded-lg border border-neutral-800">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="pool-toggle" 
                checked={config.pool?.active || false}
                onChange={(e) => setConfig(c => ({...c, pool: {...(c.pool || {width: 8, length: 4}), active: e.target.checked}}))}
                className="w-3 h-3 accent-cyan-500"
              />
              <label htmlFor="pool-toggle" className="text-[10px] font-bold text-stone-300 cursor-pointer">INCLUIR PILETA</label>
            </div>
            {config.pool?.active && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-stone-500 uppercase">Ancho</label>
                  <Input 
                    type="number" value={config.pool.width} 
                    onChange={(e) => setConfig(c => ({...c, pool: {...c.pool!, width: Number(e.target.value)}}))} 
                    className="h-7 bg-neutral-800 border-neutral-700 text-[10px]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-stone-500 uppercase">Largo</label>
                  <Input 
                    type="number" value={config.pool.length} 
                    onChange={(e) => setConfig(c => ({...c, pool: {...c.pool!, length: Number(e.target.value)}}))} 
                    className="h-7 bg-neutral-800 border-neutral-700 text-[10px]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Barra de presupuesto fija SÓLO en móvil — encima del canvas, sin tapar el 3D */}
      {isMobile && (
        <div className="w-full bg-neutral-950/95 border-b border-neutral-800 px-4 py-2 flex items-center justify-between z-30 flex-shrink-0" style={{ backdropFilter: 'blur(8px)' }}>
          <div>
            <div className="text-[9px] text-stone-500 uppercase tracking-wider font-semibold">Presupuesto</div>
            <div className="text-sm font-bold text-cyan-400">${totalCost.toLocaleString('es-AR')} <span className="text-[9px] text-cyan-700">ARS</span></div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-emerald-400">U$D {Math.round(totalCost / 1400).toLocaleString('en-US')}</div>
            <div className="text-[9px] text-stone-500">{totalM2} m² · {calidad}</div>
          </div>
          <button
            onClick={() => {
              sessionStorage.setItem("aurabuild_config", JSON.stringify(config));
              sessionStorage.setItem("aurabuild_totalM2", totalM2.toString());
              sessionStorage.setItem("aurabuild_calidad", calidad);
              sessionStorage.setItem("aurabuild_totalCost", totalCost.toString());
              window.location.href = '/builder/dashboard';
            }}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider border border-cyan-400/50 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            Analytics
          </button>
        </div>
      )}

      <div className="relative flex-1 min-w-0 bg-[#0a0a0a] flex items-center justify-center" style={{ minHeight: isMobile ? '0' : '100vh' }}>
        {/* Presupuesto en Desktop — NO se renderiza en móvil */}
        {!isMobile && (
          <div className="absolute top-6 right-6 z-10 bg-neutral-900 border border-neutral-800 p-6 rounded-xl shadow-2xl min-w-[320px]">
            <h3 className="text-stone-400 text-sm font-medium uppercase tracking-wider mb-1">Presupuesto Real</h3>
            <div className="text-4xl font-bold text-cyan-500 mb-0">${totalCost.toLocaleString('es-AR')} <span className="text-base font-normal text-cyan-700">ARS</span></div>
            <div className="text-lg font-semibold text-emerald-500 mb-4">U$D {Math.round(totalCost / 1400).toLocaleString('en-US')} <span className="text-xs font-normal text-stone-500">aprox (1:1400)</span></div>
            <div className="text-xs text-stone-500 flex flex-col gap-1">
              <div className="flex justify-between w-full gap-4">
                <span>Sup. Total / Terreno:</span>
                <span className="text-white text-right"><b className="text-white">{totalM2} m²</b> ({config.environment?.split('_')[0]})</span>
              </div>
              <div className="flex justify-between w-full">
                <span>Calidad:</span>
                <span className="capitalize text-stone-300 text-right">{calidad}</span>
              </div>
              {config.pool?.active && (
                <div className="flex justify-between w-full text-cyan-400">
                  <span>Adicionales:</span>
                  <span className="text-right">+ Pileta ({config.pool.width}x{config.pool.length}m)</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Botón Analytics — solo en desktop, en móvil está en la barra superior */}
        {!isMobile && (
          <button 
            onClick={() => {
               sessionStorage.setItem("aurabuild_config", JSON.stringify(config));
               sessionStorage.setItem("aurabuild_totalM2", totalM2.toString());
               sessionStorage.setItem("aurabuild_calidad", calidad);
               sessionStorage.setItem("aurabuild_totalCost", totalCost.toString());
               window.location.href = '/builder/dashboard';
            }}
            className="absolute bottom-8 right-8 z-20 bg-cyan-600 hover:bg-cyan-400 text-white px-6 py-4 rounded-xl font-bold shadow-[0_0_25px_rgba(58,190,255,0.4)] transition-all flex items-center gap-3 border border-cyan-400/50 text-sm"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            Generar Analytics Board
          </button>
        )}

        {/* Botones de acción — esquina inferior izquierda */}
        <div className="absolute bottom-3 left-3 z-20 flex flex-row gap-1.5 md:bottom-8 md:left-8 md:gap-2">
          <button
            onClick={handleCapture}
            className="flex items-center gap-2 p-2.5 md:px-4 md:py-2.5 rounded-lg md:rounded-xl bg-neutral-900/90 border border-neutral-700 text-stone-300 hover:text-cyan-400 hover:border-cyan-500 text-xs font-bold uppercase tracking-wider backdrop-blur-sm transition-all shadow-lg"
            title="Capturar imagen del render actual"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" strokeWidth="2"/></svg>
            <span className="hidden md:inline">Capturar Render</span>
          </button>
          <button
            onClick={handleExportGLB}
            className="flex items-center gap-2 p-2.5 md:px-4 md:py-2.5 rounded-lg md:rounded-xl bg-neutral-900/90 border border-neutral-700 text-stone-300 hover:text-emerald-400 hover:border-emerald-500 text-xs font-bold uppercase tracking-wider backdrop-blur-sm transition-all shadow-lg"
            title="Exportar modelo 3D en formato GLB"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            <span className="hidden md:inline">Exportar GLB</span>
          </button>
          <button
            onClick={() => setWireframeMode(w => !w)}
            className={`flex items-center gap-2 p-2.5 md:px-4 md:py-2.5 rounded-lg md:rounded-xl border text-xs font-bold uppercase tracking-wider backdrop-blur-sm transition-all shadow-lg ${
              wireframeMode
                ? 'bg-cyan-900/80 border-cyan-500 text-cyan-400 shadow-cyan-500/20'
                : 'bg-neutral-900/90 border-neutral-700 text-stone-300 hover:text-cyan-400 hover:border-cyan-500'
            }`}
            title="Activar/desactivar malla técnica (wireframe)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
            <span className="hidden md:inline">{wireframeMode ? 'Estructura Activa' : 'Estructura Alámbrica'}</span>
          </button>
        </div>

        <CasaBuilder config={config} wireframe={wireframeMode} />
      </div>
    </div>
  );
}