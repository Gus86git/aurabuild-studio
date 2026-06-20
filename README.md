# 🏠 AuraBuild 3D Architect - Auditoría de Proyecto

## 📋 Resumen del Sistema
AuraBuild es una plataforma avanzada de visualización arquitectónica y presupuestación en tiempo real. Utiliza un motor de renderizado 3D basado en **Three.js** integrado con **Next.js 14**, permitiendo a los usuarios diseñar viviendas modulares, visualizar planos técnicos y obtener estimaciones de costos precisas basadas en el mercado actual (ARS/USD).

---

## 🏗️ Características Implementadas (Reales)

### 1. Motor 3D y Visualización
*   **Modos de Visualización Dinámicos:**
    *   **Realista 3D:** Renderizado con texturas de alta calidad, iluminación ambiental y direccional.
    *   **Plano de Planta (2D Técnico):** Vista cenital ortográfica con muros seccionados a 1.1m y etiquetas de ambiente.
    *   **Blueprint (Azul Técnico):** Estética de plano arquitectónico tradicional con rejilla cian y símbolos de mobiliario.
    *   **Boceto / Sketch:** Estilo minimalista en blanco y negro para enfoque en volúmenes.
*   **Entornos Dinámicos:** Fondos fotográficos reales de **Sierras de Córdoba** y **Cordillera de los Andes (Mendoza)** que cambian según la zona seleccionada.
*   **Esqueleto Estructural:** Visualización de vigas, columnas y fundaciones para análisis técnico.

### 2. Diseño Arquitectónico Modular
*   **Gestión de Plantas:** Soporte para hasta 4 niveles independientes.
*   **Ambientes Editables:** Configuración individual de dimensiones (ancho, alto, largo), tipo de ambiente (Cocina, Living, etc.) y texturas de muros/pisos.
*   **Elementos Exteriores:**
    *   **Garages:** Módulos de cochera integrados con vehículos (Sedán/SUV) orientados correctamente.
    *   **Piletas:** Dimensionamiento personalizado y renderizado con shaders de agua.
    *   **Jardines:** 3 estilos (Césped, Japonés, Tropical) con vegetación que respeta las áreas de circulación (driveways).
    *   **Terrazas:** 3 estilos (Simple, Pérgola, Jardín en Altura) con mobiliario y barandas de vidrio.

### 3. Sistema de Presupuestación (Fintech)
*   **Cálculo en Tiempo Real:** Algoritmo ponderado por tipo de ambiente (cocinas y baños tienen mayor costo por m² que dormitorios).
*   **Conversión de Moneda:** Dashboard con tipo de cambio dinámico (ARS 1400 : 1 USD).
*   **Factores Multiplicadores:** Ajuste automático por calidad de obra (Económica, Estándar, Premium) y zona geográfica.

---

## 🛠️ Detalles Técnicos de la Auditoría

| Componente | Estado | Nota del Arquitecto |
| :--- | :--- | :--- |
| **Render Order** | ✅ Optimizado | Etiquetas de ambiente configuradas con `renderOrder: 9999` y `depthTest: false`. |
| **Malla Técnica** | ✅ Funcional | Grid de 1m x 1m implementado en vistas de planta. |
| **Simbolización** | ✅ Realista | Puertas y ventanas incluyen arcos de apertura y símbolos técnicos en 2D. |
| **Hydration Safe** | ✅ Corregido | Implementado check de `mounted` y `suppressHydrationWarning` para evitar errores por extensiones. |
| **Mobile Ready** | ✅ Adaptado | Interfaz colapsable para edición en dispositivos móviles. |

---

## 🚀 Próximas Mejoras (Roadmap Sugerido)
1.  **Exportación PDF:** Generar el presupuesto detallado en un documento formal descargable.
2.  **Muebles 3D:** Pasar de símbolos 2D a modelos 3D de alta fidelidad dentro de los ambientes.
3.  **Realidad Aumentada (AR):** Visualizar la casa diseñada sobre el terreno real usando la cámara del móvil.
4.  **Simulación Lumínica:** Estudio de sombras según la posición real del sol en la ubicación elegida.

---
*Auditoría realizada por Antigravity AI - 2024*
