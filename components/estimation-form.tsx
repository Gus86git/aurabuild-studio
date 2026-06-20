"use client"

import { useState, useEffect } from "react"
import { COSTS_ARS } from "@/lib/costs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Calculator } from "lucide-react"

export function EstimationForm() {
  const [m2, setM2] = useState<number>(100);
  const [quality, setQuality] = useState<keyof typeof COSTS_ARS.ESTIMATED_COST_PER_M2>("standard");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalCost = m2 * COSTS_ARS.ESTIMATED_COST_PER_M2[quality];

  if (!mounted) return null; // Or a non-localized placeholder

  return (
    <section className="py-20 px-4 bg-neutral-900 border-t border-neutral-800">
      <div className="container mx-auto max-w-4xl">
        <Card className="border border-neutral-800 bg-neutral-950 shadow-2xl">
          <CardHeader className="text-center pb-8 border-b border-neutral-800">
            <CardTitle className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Estimador Dinámico AuraBuild
            </CardTitle>
            <p className="text-xl text-stone-400 max-w-2xl mx-auto">
              Calcula el costo de tu obra al instante con precios de Argentina (Marzo 2026).
            </p>
          </CardHeader>

          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-stone-300 mb-2">Metros Cuadrados (m²)</label>
                  <input 
                    type="range" 
                    min="40" 
                    max="500" 
                    step="10"
                    value={m2} 
                    onChange={(e) => setM2(Number(e.target.value))}
                    className="w-full accent-cyan-500 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-right text-cyan-500 font-bold mt-2">{m2} m²</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-300 mb-2">Calidad de Terminaciones</label>
                  <select 
                    value={quality} 
                    onChange={(e) => setQuality(e.target.value as any)}
                    className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-lg p-3 outline-none focus:border-cyan-500 transition-colors"
                  >
                    <option value="economic">Económica ($850k /m²)</option>
                    <option value="standard">Estándar ($1.2M /m²)</option>
                    <option value="premium">Premium ($1.85M /m²)</option>
                  </select>
                </div>
              </div>

              <div className="bg-neutral-900 rounded-xl p-8 border border-neutral-800 flex flex-col justify-center text-center">
                <div className="mb-4">
                  <Calculator className="h-10 w-10 text-cyan-500 mx-auto" />
                </div>
                <h4 className="font-semibold text-stone-400 mb-2">Costo Total Estimado</h4>
                <div className="text-4xl font-bold text-white mb-4">
                  ${totalCost.toLocaleString('es-AR')} ARS
                </div>
                <p className="text-xs text-stone-500">
                  Valores referenciales. No incluye terreno ni trámites municipales. Cemento estim.: ${COSTS_ARS.MATERIALS.cemento_50kg.toLocaleString('es-AR')} bolsa.
                </p>
                <Button className="mt-6 bg-cyan-600 hover:bg-cyan-700 w-full text-white">
                  Generar Presupuesto PDF <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
