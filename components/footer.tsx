import { Home, Mail, Phone, MapPin } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-neutral-900 border-t border-neutral-800 text-white py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Home className="h-6 w-6 text-cyan-500" />
              <span className="text-xl font-bold">AuraBuild</span>
            </div>
            <p className="text-stone-400">
              Precisión arquitectónica y control financiero para tus proyectos de construcción. 
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Servicios</h4>
            <ul className="space-y-2 text-stone-300">
              <li>Estimación de Costos</li>
              <li>Consultoría</li>
              <li>Planificación</li>
              <li>Seguimiento de Obra</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Recursos</h4>
            <ul className="space-y-2 text-stone-300">
              <li>Calculadora</li>
              <li>Guías</li>
              <li>Blog</li>
              <li>FAQ</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contacto</h4>
            <div className="space-y-2 text-stone-300">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>info@aurabuild.studio</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>Buenos Aires, Argentina</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-800 mt-8 pt-8 text-center text-stone-500">
          <p>&copy; 2026 AuraBuild Studio.</p>
        </div>
      </div>
    </footer>
  )
}
