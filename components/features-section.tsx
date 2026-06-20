import { Card, CardContent } from "@/components/ui/card"
import { Home, MapPin, Hammer, Palette, Users, Calculator } from "lucide-react"

const features = [
  {
    icon: Home,
    title: "Metros Cuadrados",
    description: "Calcula según el tamaño exacto de tu proyecto",
  },
  {
    icon: Users,
    title: "Cantidad de Ambientes",
    description: "Dormitorios, baños, cocina y espacios comunes",
  },
  {
    icon: Calculator,
    title: "Módulos Adicionales",
    description: "Garaje, piscina, jardín y extensiones",
  },
  {
    icon: MapPin,
    title: "Ubicación",
    description: "Costos ajustados según la zona geográfica",
  },
  {
    icon: Palette,
    title: "Calidad de Materiales",
    description: "Desde básico hasta premium y lujo",
  },
  {
    icon: Hammer,
    title: "Mano de Obra",
    description: "Especializada según el tipo de construcción",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-20 px-4 bg-neutral-950 border-t border-neutral-900">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Métricas Analizadas</h2>
          <p className="text-xl text-stone-400 max-w-2xl mx-auto">
            AuraBuild procesa múltiples variables topológicas y de mercado para entregar precisión absoluta.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-neutral-800 bg-neutral-900 hover:border-cyan-500/30 transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-cyan-950 p-3 rounded-lg border border-cyan-900/50">
                    <feature.icon className="h-6 w-6 text-cyan-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-stone-400 text-sm">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
