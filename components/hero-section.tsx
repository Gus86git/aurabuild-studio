"use client"

import { Button } from "@/components/ui/button"
import { Calculator, Home, Users } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import CasaBuilder from "@/components/CasaBuilder"
import { useRouter } from "next/navigation"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { useState, useEffect } from "react"
import type { UseEmblaCarouselType } from "embla-carousel-react"

type EmblaCarouselType = UseEmblaCarouselType[1];

declare global {
  interface Window {
    botpressWebChat?: {
      sendEvent: (event: { type: string }) => void;
    };
  }
}

export function HeroSection() {
  const router = useRouter();
  const handleChatbotClick = () => {
    router.push("/builder");
  }
  const casaConfig: import("@/components/CasaBuilder").CasaConfig = {
    ambientes: [
      { origen: [0, 0, 0], dimensiones: [3, 2.5, 4] },
      { origen: [3, 0, 0], dimensiones: [2, 2.5, 3] }
    ],
    techo: {
      base: [ [0,2.5,0], [5,2.5,0], [5,2.5,4], [0,2.5,4] ],
      pico: [2.5,4,2]
    },
    objetos: [
      { origen: [1,0,1], dimensiones: [1,1,1] }
    ]
  }

  const galleryProjects = [
    {
      title: "Casa Moderna Minimalista",
      size: "180m²",
      cost: "$95,000",
      image: "/casa-moderna-minimalista.jpg?height=300&width=400",
    },
    {
      title: "Casa Familiar Tradicional",
      size: "220m²",
      cost: "$120,000",
      image: "/casa-familiar-tradicional.jpg?height=300&width=400",
    },
    {
      title: "Casa Compacta Urbana",
      size: "120m²",
      cost: "$65,000",
      image: "/casa-compacta-urbana.jpg?height=300&width=400",
    },
    {
      title: "Casa de Campo Rústica",
      size: "250m²",
      cost: "$140,000",
      image: "/casa-de-campo-rustica.jpg?height=300&width=400",
    },
    {
      title: "Casa Moderna con Iluminación LED",
      size: "210m²",
      cost: "$160,000",
      image: "/casa-moderna-led.jpg?height=300&width=400",
    },
    {
      title: "Casa de Campo Elevada",
      size: "130m²",
      cost: "$90,000",
      image: "/casa-campo-elevada.jpg?height=300&width=400",
    },
    {
      title: "Casa Tradicional de Ladrillo",
      size: "140m²",
      cost: "$100,000",
      image: "/casa-ladrillo-tradicional.jpg?height=300&width=400",
    },
    {
      title: "Cabaña Alpina A-Frame",
      size: "95m²",
      cost: "$80,000",
      image: "/cabana-a-frame.jpg?height=300&width=400",
    },
    {
      title: "Tiny House Moderna",
      size: "45m²",
      cost: "$45,000",
      image: "/tiny-house-moderna.jpg?height=300&width=400",
    },
    {
      title: "Casa Modular Escandinava",
      size: "70m²",
      cost: "$65,000",
      image: "/casa-modular-escandinava.jpg?height=300&width=400",
    },
  ]

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<EmblaCarouselType | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Actualiza el índice seleccionado cuando cambia el slide
  const handleSelect = (api: EmblaCarouselType) => {
    if (!api) return;
    setSelectedIndex(api.selectedScrollSnap());
  };

  if (!mounted) return <div className="min-h-screen bg-neutral-950" />; // Placeholder

  return (
    <section className="relative bg-neutral-950 py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-6xl font-bold text-white leading-tight">
                Diseña tu casa en 3D
                <span className="text-cyan-500 block">AuraBuild Studio</span>
              </h1>
              <p className="text-xl text-stone-400 leading-relaxed">
                Visualización arquitectónica de precisión y cálculo de obra en tiempo real. 
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button
                onClick={handleChatbotClick}
                size="lg"
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-4 text-lg"
              >
                <Home className="mr-2 h-5 w-5" />
                Ir al Diseñador 3D
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="lg" className="border-cyan-800 text-cyan-400 bg-transparent hover:bg-cyan-900/50 hover:text-cyan-300 px-8 py-4 text-lg">
                    Ver Galería
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl w-full p-0 sm:p-4 max-h-screen flex flex-col items-center">
                  <DialogTitle className="mb-2 sm:mb-4">Galería de Proyectos</DialogTitle>
                  <Carousel setApi={(api: EmblaCarouselType) => {
                    setCarouselApi(api);
                    if (api) {
                      api.on('select', () => handleSelect(api));
                    }
                  }}>
                    <CarouselContent>
                      {galleryProjects.map((project, idx) => (
                        <CarouselItem
                          key={idx}
                          className="basis-full flex items-center justify-center w-full h-[60vh] max-w-none"
                        >
                          <img
                            src={project.image}
                            alt={project.title}
                            className="w-full h-full object-contain"
                          />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                  </Carousel>
                  {/* Texto debajo del carrusel */}
                  <hr className="my-4 border-neutral-800 w-1/2 mx-auto" />
                  <div className="text-center mt-2">
                    <div className="text-xl font-bold text-white">
                      {galleryProjects[selectedIndex]?.title}
                    </div>
                    <div className="text-stone-400">
                      {galleryProjects[selectedIndex]?.size}
                    </div>
                    <div className="text-cyan-500 font-bold text-2xl mt-2">
                      {galleryProjects[selectedIndex]?.cost}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex items-center gap-8 pt-4">
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5 text-cyan-500" />
                <span className="text-stone-400">Precision AR/3D</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-cyan-500" />
                <span className="text-stone-400">Arquitectura Premium</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="/hero_image.png"
                alt="AuraBuild Luxury Modern Villa 3D representation"
                className="w-full h-[500px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-neutral-900 border border-neutral-800 p-6 rounded-xl shadow-lg">
              <div className="text-2xl font-bold text-cyan-500">$850.000 (ARS)</div>
              <div className="text-stone-400">Costo m² Estándar</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
