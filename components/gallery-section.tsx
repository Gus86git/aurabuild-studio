const projects = [
  {
    title: "Interior Lounge Moderno",
    size: "80m²",
    cost: "$96.000.000 ARS",
    image: "/gallery1.png",
  },
  {
    title: "Villa Exterior Minimalista",
    size: "220m²",
    cost: "$264.000.000 ARS",
    image: "/gallery2.png",
  },
  {
    title: "Cocina Haute Design",
    size: "45m²",
    cost: "$83.250.000 ARS",
    image: "/gallery3.png",
  },
  {
    title: "Residencia Twilight",
    size: "350m²",
    cost: "$420.000.000 ARS",
    image: "/hero_image.png",
  },
]

export function GallerySection() {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Portafolio Arquitectónico</h2>
          <p className="text-xl text-stone-400 max-w-2xl mx-auto">
            Explora nuestros renders de alta fidelidad y sus estimaciones de mercado.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {projects.map((project, index) => (
            <div
              key={index}
              className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-lg hover:border-cyan-500/50 hover:shadow-cyan-500/10 transition-all duration-300"
            >
              <div className="relative">
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-4 right-4 bg-cyan-600/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-semibold">
                  {project.cost}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-white mb-2">{project.title}</h3>
                <p className="text-stone-400 text-sm">{project.size}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
