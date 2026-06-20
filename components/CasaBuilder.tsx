"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
// @ts-ignore: OrbitControls no tiene tipos en three.js por defecto
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

type Elemento = {
  origen: [number, number, number];
  dimensiones: [number, number, number];
};

export type CasaConfig = {
  ambientes: Elemento[];
  techo?: {
    base: [number, number, number][];
    pico: [number, number, number];
  };
  objetos?: Elemento[];
  escalera?: Elemento[];
};

type AmbienteEditable = {
  origen: [number, number, number];
  dimensiones: [number, number, number];
  wallColor?: string;
  tipo?: 'living' | 'cocina' | 'dormitorio' | 'baño' | 'comedor' | 'oficina';
};

class WorldBoxGeometry extends THREE.BoxGeometry {
  constructor(w = 1, h = 1, d = 1, ws = 1, hs = 1, ds = 1, worldPos: [number, number, number] = [0, 0, 0]) {
    super(w, h, d, ws, hs, ds);
    const uvAttribute = this.attributes.uv;
    if (uvAttribute) {
      const uvScale = 0.5; // 1 textura cada 2 metros para realismo
      const [wx, wy, wz] = worldPos;
      
      // Face order in Three.js BoxGeometry:
      // 0: Right (+X), 1: Left (-X), 2: Top (+Y), 3: Bottom (-Y), 4: Front (+Z), 5: Back (-Z)
      const configs = [
        { scale: [d, h], offset: [wz, wy] }, // Right (+X) -> plane is Z, Y
        { scale: [d, h], offset: [wz, wy] }, // Left (-X)  -> plane is Z, Y
        { scale: [w, d], offset: [wx, wz] }, // Top (+Y)   -> plane is X, Z
        { scale: [w, d], offset: [wx, wz] }, // Bottom (-Y) -> plane is X, Z
        { scale: [w, h], offset: [wx, wy] }, // Front (+Z)  -> plane is X, Y
        { scale: [w, h], offset: [wx, wy] }  // Back (-Z)   -> plane is X, Y
      ];

      for (let i = 0; i < 6; i++) {
        const config = configs[i];
        const sU = config.scale[0] * uvScale;
        const sV = config.scale[1] * uvScale;
        const oU = config.offset[0] * uvScale;
        const oV = config.offset[1] * uvScale;
        
        for (let j = 0; j < 4; j++) {
          const idx = i * 4 + j;
          const u = uvAttribute.getX(idx);
          const v = uvAttribute.getY(idx);
          // Scale original normalized UV and add world-based offset
          uvAttribute.setXY(idx, u * sU + oU, v * sV + oV);
        }
      }
      uvAttribute.needsUpdate = true;
    }
  }
}

export type Distribucion = 'fila' | 'cuadricula';

export type CasaBuilderConfig = {
  ambientes: (AmbienteEditable & { planta: number })[];
  plantas: number;
  distribuciones: Distribucion[];
  wallTexture: string;
  floorTexture: string;
  roofTexture: string;
  wallColor: string; // deprecado
  roofColor: string; // deprecado
  objectColor: string;
  objetos?: Elemento[];
  escalera?: Elemento[];
  roofType?: "flat" | "gable";
  solarPanels?: boolean;
  pool?: { active: boolean, width: number, length: number };
  environment?: "campo_sierras" | "montaña_mendoza" | "ciudad_premium";
  garages?: number;
  doorStyle?: "moderna" | "colonial" | "minimalista" | "madera_vidrio";
  windowStyle?: "simple" | "panoramica" | "arco";
  gardenStyle?: "ninguno" | "cesped" | "japones" | "tropical" | "zen";
  terrace?: "ninguna" | "simple" | "pergola" | "rooftop_garden";
  viewMode?: "perspective" | "floorplan" | "blueprint" | "sketch";
  stylePreset?: "standard" | "modern" | "industrial" | "scandinavian";
  lote?: { width: number, length: number };
  quincho?: { active: boolean, width: number, length: number };
};

type Props = {
  config: CasaBuilderConfig;
  wireframe?: boolean;
};

// Utilidad para calcular la cuadrícula más cuadrada posible
function getGrid(n: number) {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { rows, cols };
}

// ====================================================
// NUEVAS FUNCIONES 3D: VENTANAS, GARAGE Y AUTO
// ====================================================

function addVentanas(
  scene: THREE.Scene,
  ambientes: (AmbienteEditable & { planta: number })[],
  windowStyle: string = "simple",
  allAmbientes: (AmbienteEditable & { planta: number })[]
) {
  const glassColor  = windowStyle === 'panoramica' ? '#4fc3f7' : '#87ceeb';
  const frameMat    = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ 
    color: '#aaddff', 
    transparent: true, 
    opacity: 0.4, 
    roughness: 0.1, 
    metalness: 0.5,
    envMapIntensity: 1.5
  });
  const TOL = 0.1;

  ambientes.forEach(a => {
    const [x, y, z] = a.origen;
    const [dx, dy, dz] = a.dimensiones;
    const cx = x + dx / 2;
    const cz = z + dz / 2;

    const winW = windowStyle === 'panoramica' ? Math.min(dx * 0.65, 2.4) : Math.min(dx * 0.45, 1.4);
    const winH = windowStyle === 'panoramica' ? Math.min(dy * 0.55, 1.8) : 0.9;
    const winY = windowStyle === 'panoramica' ? y + dy * 0.25 : y + dy * 0.5;
    
    // Check if a face is exterior (no adjacent room on same floor)
    const sameFloor = allAmbientes.filter(b => b !== a && b.planta === a.planta);

    const isExteriorFront = !sameFloor.some(b =>
      Math.abs((z + dz) - b.origen[2]) < TOL &&
      b.origen[0] < x + dx && b.origen[0] + b.dimensiones[0] > x
    );
    const isExteriorBack = !sameFloor.some(b =>
      Math.abs(z - (b.origen[2] + b.dimensiones[2])) < TOL &&
      b.origen[0] < x + dx && b.origen[0] + b.dimensiones[0] > x
    );
    const isExteriorLeft = !sameFloor.some(b =>
      Math.abs(x - (b.origen[0] + b.dimensiones[0])) < TOL &&
      b.origen[2] < z + dz && b.origen[2] + b.dimensiones[2] > z
    );
    const isExteriorRight = !sameFloor.some(b =>
      Math.abs((x + dx) - b.origen[0]) < TOL &&
      b.origen[2] < z + dz && b.origen[2] + b.dimensiones[2] > z
    );

    // Technical 2D Window Lines (only in plan modes)
    const isPlan = scene.userData.isTechnical;
    const symbolColor = scene.userData.isBlueprint ? '#ffffff' : '#333333';
    const lineMat2D = new THREE.LineBasicMaterial({ color: symbolColor, transparent: true, opacity: 0.8 });

    // Helper for 2D Window Symbol
    const addWindowSymbol = (pos: [number, number, number], size: [number, number], vertical: boolean) => {
      if (!isPlan) return;
      const [px, py, pz] = pos;
      const [sw, sd] = size;
      const points = [];
      const offset = 0.08;
      if (vertical) {
        points.push(new THREE.Vector3(0, 0, -sd/2), new THREE.Vector3(0, 0, sd/2));
        points.push(new THREE.Vector3(-offset, 0, -sd/2), new THREE.Vector3(-offset, 0, sd/2));
        points.push(new THREE.Vector3(offset, 0, -sd/2), new THREE.Vector3(offset, 0, sd/2));
      } else {
        points.push(new THREE.Vector3(-sw/2, 0, 0), new THREE.Vector3(sw/2, 0, 0));
        points.push(new THREE.Vector3(-sw/2, 0, -offset), new THREE.Vector3(sw/2, 0, -offset));
        points.push(new THREE.Vector3(-sw/2, 0, offset), new THREE.Vector3(sw/2, 0, offset));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const lines = new THREE.LineSegments(geo, lineMat2D);
      lines.position.set(px, py - winY + 0.05, pz); // on the floor
      scene.add(lines);
    };

    // Front face window (z+dz)
    if (isExteriorFront) {
      const winZ = z + dz;
      addWindowSymbol([cx, winY, winZ], [winW, 0], false);
      if (windowStyle === 'arco') {
        // Arco: ventana rectangular + arco semicircular encima
        const frameGeom = new WorldBoxGeometry(winW + 0.06, winH + 0.06, 0.08);
        const frame = new THREE.Mesh(frameGeom, frameMat);
        frame.position.set(cx, winY + winH/2, winZ);
        scene.add(frame);
        const glassGeom = new WorldBoxGeometry(winW, winH, 0.06);
        const glass = new THREE.Mesh(glassGeom, glassMat);
        glass.position.set(cx, winY + winH/2, winZ);
        scene.add(glass);
        // Arch top
        const archGeom = new THREE.CylinderGeometry(winW/2, winW/2, 0.08, 12, 1, false, 0, Math.PI);
        const arch = new THREE.Mesh(archGeom, frameMat);
        arch.rotation.x = Math.PI / 2;
        arch.position.set(cx, winY + winH, winZ);
        scene.add(arch);
      } else {
        const frameGeom = new WorldBoxGeometry(winW + 0.08, winH + 0.08, 0.08);
        const frame = new THREE.Mesh(frameGeom, frameMat);
        frame.position.set(cx, winY + winH/2, winZ);
        scene.add(frame);
        if (windowStyle === 'panoramica') {
          // 3 panes
          const pW = winW / 3 - 0.02;
          for (let i=0; i<3; i++) {
            const g = new THREE.Mesh(new WorldBoxGeometry(pW, winH - 0.04, 0.06), glassMat);
            g.position.set(cx - winW/2 + pW/2 + i * (winW/3), winY + winH/2, winZ);
            scene.add(g);
          }
        } else {
          const glassGeom = new WorldBoxGeometry(winW, winH, 0.06);
          scene.add(new THREE.Mesh(glassGeom, glassMat));
        }
      }
    }

    // Back face window (z)
    if (isExteriorBack && dz > 3) {
      const winW2 = Math.min(dx * 0.35, 1.2);
      addWindowSymbol([cx, winY, z], [winW2, 0], false);
      const frameGeom = new WorldBoxGeometry(winW2 + 0.08, winH + 0.08, 0.08);
      const frame = new THREE.Mesh(frameGeom, frameMat);
      frame.position.set(cx, winY + winH/2, z);
      scene.add(frame);
      const g = new THREE.Mesh(new WorldBoxGeometry(winW2, winH, 0.06), glassMat);
      g.position.set(cx, winY + winH/2, z);
      scene.add(g);
    }

    // Left face (x)
    if (isExteriorLeft) {
      const winW3 = Math.min(dz * 0.4, 1.2);
      addWindowSymbol([x, winY, cz], [0, winW3], true);
      const frame = new THREE.Mesh(new WorldBoxGeometry(0.08, winH + 0.08, winW3 + 0.08), frameMat);
      frame.position.set(x, winY + winH/2, cz);
      scene.add(frame);
      const g = new THREE.Mesh(new WorldBoxGeometry(0.06, winH, winW3), glassMat);
      g.position.set(x, winY + winH/2, cz);
      scene.add(g);
    }

    // Right face (x+dx)
    if (isExteriorRight) {
      const winW4 = Math.min(dz * 0.4, 1.2);
      addWindowSymbol([x + dx, winY, cz], [0, winW4], true);
      const frame = new THREE.Mesh(new WorldBoxGeometry(0.08, winH + 0.08, winW4 + 0.08), frameMat);
      frame.position.set(x + dx, winY + winH/2, cz);
      scene.add(frame);
      const g = new THREE.Mesh(new WorldBoxGeometry(0.06, winH, winW4), glassMat);
      g.position.set(x + dx, winY + winH/2, cz);
      scene.add(g);
    }
  });
}

function addAuto(scene: THREE.Scene, px: number, pz: number, color: string = '#2a4e8a', variant: 'sedan' | 'suv' = 'sedan') {
  const carGroup = new THREE.Group();
  
  // Materials
  const paintMat = new THREE.MeshStandardMaterial({ 
    color, 
    metalness: 0.9, 
    roughness: 0.15
  });
  const windowMat = new THREE.MeshStandardMaterial({ 
    color: '#1a1a1a', 
    transparent: true, 
    opacity: 0.8, 
    roughness: 0, 
    metalness: 1 
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 1, roughness: 0.2 });
  const lightMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffcc', emissiveIntensity: 2 });
  const tailLightMat = new THREE.MeshStandardMaterial({ color: '#990000', emissive: '#ff0000', emissiveIntensity: 1.5 });

  const isSUV = variant === 'suv';
  const width = 1.9;
  const length = isSUV ? 4.8 : 4.6;
  const height = isSUV ? 1.7 : 1.35;

  // Body - Lower part (chassis)
  const chassisH = height * 0.45;
  const chassis = new THREE.Mesh(
    new WorldBoxGeometry(length, chassisH, width),
    paintMat
  );
  chassis.position.y = chassisH / 2 + 0.2;
  carGroup.add(chassis);

  // Body - Upper part (cabin)
  const cabinW = width * 0.88;
  const cabinL = length * 0.55;
  const cabinH = height * 0.48;
  const cabin = new THREE.Mesh(
    new WorldBoxGeometry(cabinL, cabinH, cabinW),
    paintMat
  );
  cabin.position.set(-length * 0.05, chassisH + cabinH / 2 + 0.18, 0);
  carGroup.add(cabin);

  // Windows (slightly smaller than cabin to avoid fighting)
  const windows = new THREE.Mesh(
    new WorldBoxGeometry(cabinL + 0.01, cabinH * 0.8, cabinW + 0.01),
    windowMat
  );
  windows.position.set(-length * 0.05, chassisH + cabinH / 2 + 0.18, 0);
  carGroup.add(windows);

  // Wheels
  const wheelRadius = 0.34;
  const wheelThickness = 0.26;
  const wheelPosEX = length * 0.32;
  const wheelPosEZ = width * 0.46;
  
  const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 24);
  const rimGeom = new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelThickness + 0.02, 12);

  [[-wheelPosEX, -wheelPosEZ], [-wheelPosEX, wheelPosEZ], [wheelPosEX, -wheelPosEZ], [wheelPosEX, wheelPosEZ]].forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(wheelGeom, tireMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wheelRadius, wz);
    carGroup.add(wheel);
    
    const rim = new THREE.Mesh(rimGeom, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(wx, wheelRadius, wz);
    carGroup.add(rim);
  });

  // Lights
  const lightGeom = new WorldBoxGeometry(0.12, 0.18, 0.45);
  
  // Front lights
  const fl = new THREE.Mesh(lightGeom, lightMat);
  fl.position.set(length/2, chassisH + 0.15, width/2 - 0.35);
  carGroup.add(fl);
  const fr = fl.clone();
  fr.position.z = -width/2 + 0.35;
  carGroup.add(fr);

  // Tail lights
  const rl = new THREE.Mesh(lightGeom, tailLightMat);
  rl.position.set(-length/2, chassisH + 0.15, width/2 - 0.35);
  carGroup.add(rl);
  const rr = rl.clone();
  rr.position.z = -width/2 + 0.35;
  carGroup.add(rr);

  // Mirrors
  const mirrorGeom = new WorldBoxGeometry(0.18, 0.12, 0.28);
  const ml = new THREE.Mesh(mirrorGeom, paintMat);
  ml.position.set(length * 0.18, chassisH + 0.35, width/2 + 0.08);
  carGroup.add(ml);
  const mr = ml.clone();
  mr.position.z = -width/2 - 0.08;
  carGroup.add(mr);

  carGroup.position.set(px, 0, pz);
  carGroup.rotation.y = -Math.PI / 2; // Mirando hacia adelante (+Z)
  scene.add(carGroup);
}


function addGarage(
  scene: THREE.Scene,
  count: number,
  houseMinX: number, houseMaxX: number,
  houseMinZ: number, houseMaxZ: number,
  lotMaxZ: number,
  wallMat: THREE.MeshStandardMaterial,
  wireframeMode: boolean,
  garageDoorTexture: THREE.Texture | null
) {
  const garageW = 4.0;
  const garageD = 6.0;
  const garageH = 2.8;
  const roofMat = new THREE.MeshStandardMaterial({ color: '#333', wireframe: wireframeMode, roughness: 0.8 });
  const doorPanelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.7, metalness: 0.3 });

  for (let i = 0; i < Math.min(count, 3); i++) {
    // Stick it to the right wall of the house (houseMaxX)
    const garX = houseMaxX + i * garageW;
    const garZ = houseMinZ + (houseMaxZ - houseMinZ) / 2 - garageD / 2;

    // Walls
    // Back
    const back = new THREE.Mesh(new WorldBoxGeometry(garageW, garageH, 0.15, 1, 1, 1, [garX, 0, garZ]), wallMat.clone());
    back.position.set(garX + garageW/2, garageH/2, garZ);
    scene.add(back);
    
    // Front wall with door opening
    const frontL = new THREE.Mesh(new WorldBoxGeometry(0.5, garageH, 0.15, 1, 1, 1, [garX, 0, garZ + garageD]), wallMat.clone());
    frontL.position.set(garX + 0.25, garageH/2, garZ + garageD);
    scene.add(frontL);

    const frontR = new THREE.Mesh(new WorldBoxGeometry(0.5, garageH, 0.15, 1, 1, 1, [garX + garageW - 0.5, 0, garZ + garageD]), wallMat.clone());
    frontR.position.set(garX + garageW - 0.25, garageH/2, garZ + garageD);
    scene.add(frontR);

    const frontT = new THREE.Mesh(new WorldBoxGeometry(garageW, 0.6, 0.15, 1, 1, 1, [garX, garageH - 0.6, garZ + garageD]), wallMat.clone());
    frontT.position.set(garX + garageW/2, garageH - 0.3, garZ + garageD);
    scene.add(frontT);

    // Exterior Left wall (only for the first garage)
    if (i === 0) {
      const left = new THREE.Mesh(new WorldBoxGeometry(0.15, garageH, garageD, 1, 1, 1, [garX, 0, garZ]), wallMat.clone());
      left.position.set(garX, garageH/2, garZ + garageD/2);
      scene.add(left);
    }

    // Exterior Right wall (only if it's the last garage in row)
    if (i === count - 1) {
      const right = new THREE.Mesh(new WorldBoxGeometry(0.15, garageH, garageD, 1, 1, 1, [garX + garageW, 0, garZ]), wallMat.clone());
      right.position.set(garX + garageW, garageH/2, garZ + garageD/2);
      scene.add(right);
    }

    // Garage door - Usamos BoxGeometry estándar para que la textura se centre perfectamente (0 a 1)
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(garageW - 1.0, garageH - 0.6, 0.1), 
      new THREE.MeshStandardMaterial({ 
        map: garageDoorTexture,
        color: 0xffffff,
        roughness: 0.7, 
        metalness: 0.3 
      })
    );
    door.position.set(garX + garageW/2, (garageH - 0.6)/2, garZ + garageD);
    scene.add(door);

    // Flat roof with small overhang
    const roof = new THREE.Mesh(new WorldBoxGeometry(garageW + 0.2, 0.15, garageD + 0.4), roofMat);
    roof.position.set(garX + garageW/2, garageH, garZ + garageD/2);
    scene.add(roof);

    // Driveway - Perfectly aligned extending to the street
    const driveZStart = garZ + garageD;
    const driveLength = Math.max(2, lotMaxZ - driveZStart); // Extend up to the lot boundary
    const slabMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 1 });
    const slab = new THREE.Mesh(new WorldBoxGeometry(garageW, 0.02, driveLength), slabMat);
    // Y=0.03 is higher than the grass Y=0.02 so it shows on top
    slab.position.set(garX + garageW/2, 0.03, driveZStart + driveLength/2);
    scene.add(slab);

    // Add car
    const carColor = i === 0 ? '#1a3a6a' : '#6a1a1a';
    addAuto(scene, garX + garageW/2, garZ + garageD + 3.0, carColor, i === 0 ? 'sedan' : 'suv');
  }
}


function addJardin(
  scene: THREE.Scene,
  style: string,
  minX: number, maxX: number, minZ: number, maxZ: number,
  lotMinX: number, lotMaxX: number, lotMaxZ: number,
  garageX?: number, garageW?: number
) {
  const cx = (lotMinX + lotMaxX) / 2;
  const w = lotMaxX - lotMinX;
  const gardenDepth = Math.max(0, lotMaxZ - maxZ);
  if (gardenDepth <= 0) return; // No hay espacio para jardín
  
  // Logic to avoid placing trees in front of the garage driveway
  const isDriveway = (x: number) => {
    if (garageX === undefined || garageW === undefined) return false;
    return x >= garageX - 0.5 && x <= garageX + garageW + 0.5;
  };

  if (style === 'cesped') {
    const lawnMat = new THREE.MeshStandardMaterial({ color: '#1e4d10', roughness: 1.2 });
    const lawn = new THREE.Mesh(new WorldBoxGeometry(w, 0.02, gardenDepth), lawnMat);
    lawn.position.set(cx, 0.02, maxZ + gardenDepth / 2);
    scene.add(lawn);
    
    // Path decorativo hacia la puerta (asume puerta en el centro de la casa minX-maxX)
    const houseCx = (minX + maxX) / 2;
    const pathMat = new THREE.MeshStandardMaterial({ color: '#6b6b6b', roughness: 1 });
    const numStones = Math.floor(gardenDepth / 1.5);
    for (let i = 0; i < numStones; i++) {
      const stone = new THREE.Mesh(new WorldBoxGeometry(0.8, 0.02, 0.8), pathMat);
      stone.position.set(houseCx, 0.04, maxZ + 1.0 + i * 1.5);
      scene.add(stone);
    }

    // Vegetación con chequeo de Driveway
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a321a' });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#1b5e20' });
    
    // Generar posiciones aleatorias para árboles en el jardín
    for(let i=0; i < Math.floor((w * gardenDepth) / 30); i++) {
        const tx = lotMinX + 1 + Math.random() * (w - 2);
        const tz = maxZ + 4 + Math.random() * (gardenDepth - 5);
        // Evitar camino principal y driveway
        if (!isDriveway(tx) && Math.abs(tx - houseCx) > 1.5 && !scene.userData.isTechnical) {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 4, 8), trunkMat);
          trunk.position.set(tx, 2, tz);
          scene.add(trunk);
          const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 8), leafMat);
          leaves.position.set(tx, 4.5, tz);
          scene.add(leaves);
        }
    }
  } else if (style === 'japones') {
    const gravelMat = new THREE.MeshStandardMaterial({ color: '#e8e4db', roughness: 1 });
    const gravel = new THREE.Mesh(new WorldBoxGeometry(w, 0.02, gardenDepth), gravelMat);
    gravel.position.set(cx, 0.02, maxZ + gardenDepth / 2);
    scene.add(gravel);

    const stoneMat = new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.5 });
    [[cx - 4, maxZ + 3], [cx + 3, maxZ + 7]].forEach(([sx, sz]) => {
       if (!isDriveway(sx) && !scene.userData.isTechnical) {
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), stoneMat);
        stone.position.set(sx, 0.4, sz);
        scene.add(stone);
       }
    });
  } else if (style === 'tropical') {
    const soilMat = new THREE.MeshStandardMaterial({ color: '#263238', roughness: 1.5 });
    const soil = new THREE.Mesh(new WorldBoxGeometry(w + 16, 0.05, 14), soilMat);
    soil.position.set(cx, 0.01, maxZ + 7);
    scene.add(soil);

    const palmTrunkMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
    [[minX - 2, maxZ + 5], [maxX + 2, maxZ + 7], [cx + 5, maxZ + 11]].forEach(([px, pz]) => {
      if (!isDriveway(px) && !scene.userData.isTechnical) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 6, 8), palmTrunkMat);
        trunk.position.set(px, 3, pz);
        scene.add(trunk);
      }
    });
  }
}

function addTerraza(
  scene: THREE.Scene,
  style: string,
  minX: number, maxX: number, maxY: number, minZ: number, maxZ: number
) {
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const yBase = maxY;

  if (style === 'simple') {
    // Terrazo simple: piso de madera, baranda de vidrio
    const deckMat = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.7 });
    const deck = new THREE.Mesh(new WorldBoxGeometry(w, 0.08, d), deckMat);
    deck.position.set(cx, yBase + 0.04, cz);
    scene.add(deck);
    // Baranda de vidrio (perimetral)
    const railMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#a0d8ef', transparent: true, opacity: 0.35 });
    const railSegs = [
      { pos: [cx, yBase + 0.55, minZ], size: [w, 0.9, 0.04] },
      { pos: [cx, yBase + 0.55, maxZ], size: [w, 0.9, 0.04] },
      { pos: [minX, yBase + 0.55, cz], size: [0.04, 0.9, d] },
      { pos: [maxX, yBase + 0.55, cz], size: [0.04, 0.9, d] },
    ];
    railSegs.forEach(({ pos, size }) => {
      const glass = new THREE.Mesh(new WorldBoxGeometry(...(size as [number,number,number])), glassMat);
      glass.position.set(...(pos as [number,number,number]));
      scene.add(glass);
    });
    // Dos sillas de terraza low-poly
    [[cx - 1.5, cz - 1], [cx + 1.5, cz - 1]].forEach(([sx, sz]) => {
      const chairMat  = new THREE.MeshStandardMaterial({ color: '#2c2c2c', roughness: 0.5 });
      const seat = new THREE.Mesh(new WorldBoxGeometry(0.7, 0.08, 0.7), chairMat);
      seat.position.set(sx, yBase + 0.5, sz);
      scene.add(seat);
      const back = new THREE.Mesh(new WorldBoxGeometry(0.7, 0.6, 0.06), chairMat);
      back.position.set(sx, yBase + 0.85, sz - 0.32);
      scene.add(back);
    });
    // Mesa
    const tableMat = new THREE.MeshStandardMaterial({ color: '#3c3c3c', roughness: 0.4, metalness: 0.3 });
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 12), tableMat);
    table.position.set(cx, yBase + 0.76, cz - 1);
    scene.add(table);

  } else if (style === 'pergola') {
    // Terraza con pérgola de madera
    const deckMat = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.7 });
    const deck = new THREE.Mesh(new WorldBoxGeometry(w, 0.08, d), deckMat);
    deck.position.set(cx, yBase + 0.04, cz);
    scene.add(deck);
    const woodMat = new THREE.MeshStandardMaterial({ color: '#5c3d1a', roughness: 0.9 });
    // 4 columnas
    const colPositions = [[minX + 0.5, minZ + 0.5], [minX + 0.5, maxZ - 0.5], [maxX - 0.5, minZ + 0.5], [maxX - 0.5, maxZ - 0.5]];
    const pergHeight = 2.4;
    colPositions.forEach(([px, pz]) => {
      const col = new THREE.Mesh(new WorldBoxGeometry(0.14, pergHeight, 0.14), woodMat);
      col.position.set(px, yBase + pergHeight/2, pz);
      scene.add(col);
    });
    // Vigas longitudinales
    [[minX + 0.5, maxX - 0.5, minZ + 0.5], [minX + 0.5, maxX - 0.5, maxZ - 0.5]].forEach(([x1, x2, pz]) => {
      const beam = new THREE.Mesh(new WorldBoxGeometry(x2 - x1, 0.12, 0.14), woodMat);
      beam.position.set((x1 + x2) / 2, yBase + pergHeight, pz);
      scene.add(beam);
    });
    // Travesaños
    const numTraves = Math.floor(w / 1.2);
    for (let i = 0; i <= numTraves; i++) {
      const tx = minX + 0.5 + i * ((maxX - minX - 1) / numTraves);
      const traves = new THREE.Mesh(new WorldBoxGeometry(0.1, 0.1, d - 1), woodMat);
      traves.position.set(tx, yBase + pergHeight + 0.05, cz);
      scene.add(traves);
    }
    // Plantas colgantes (esferas verdes pequeñas)
    const plantMat = new THREE.MeshStandardMaterial({ color: '#3a9e2a', roughness: 1 });
    [[cx - 2, cz - 1], [cx + 1, cz + 1]].forEach(([px, pz]) => {
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), plantMat);
      plant.position.set(px, yBase + pergHeight - 0.5, pz);
      scene.add(plant);
    });

  } else if (style === 'rooftop_garden') {
    // Jardín en terraza: macetas, césped, árbol
    const deckMat = new THREE.MeshStandardMaterial({ color: '#888', roughness: 0.8 });
    const deck = new THREE.Mesh(new WorldBoxGeometry(w, 0.08, d), deckMat);
    deck.position.set(cx, yBase + 0.04, cz);
    scene.add(deck);
    // Parterres de césped
    const grassMat = new THREE.MeshStandardMaterial({ color: '#2d7e1a', roughness: 1 });
    [[cx - 2, cz - 1, 1.5, 0.9], [cx + 1.5, cz + 1, 1.2, 1.0]].forEach(([px, pz, gw, gd]) => {
      const patch = new THREE.Mesh(new WorldBoxGeometry(gw, 0.18, gd), grassMat);
      patch.position.set(px, yBase + 0.17, pz);
      scene.add(patch);
    });
    // Macetas
    const potMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.8 });
    const plantMat = new THREE.MeshStandardMaterial({ color: '#1a8a20', roughness: 1 });
    [[cx - 3, cz + 1.5], [cx + 3, cz - 1], [cx, cz + 2]].forEach(([px, pz]) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.4, 8), potMat);
      pot.position.set(px, yBase + 0.24, pz);
      scene.add(pot);
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 5), plantMat);
      plant.position.set(px, yBase + 0.7, pz);
      scene.add(plant);
    });
    // Árbol ornamental
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c3a1a' });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#ff8cc8' }); // flor rosada / cerezo
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.6, 8), trunkMat);
    trunk.position.set(cx, yBase + 0.88, cz);
    scene.add(trunk);
    const flower = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 7), leafMat);
    flower.position.set(cx, yBase + 2.4, cz);
    scene.add(flower);
  }
}

function addDecoracionPileta(
  scene: THREE.Scene,
  poolX: number,
  poolZ: number,
  poolW: number,
  poolD: number
) {
  // Reposeras (Sillas de playa) con patas y mejor forma
  const chairMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  const legMat = new THREE.MeshStandardMaterial({ color: '#555555', metalness: 0.5 });
  
  // Posiciones al costado de la pileta (derecha)
  const chairX = poolX + poolW / 2 + 1.2;
  
  for (let i = 0; i < 2; i++) {
    const chairZ = poolZ - 0.7 + i * 1.5;
    const chair = new THREE.Group();
    
    // Cuerpo principal
    const base = new THREE.Mesh(new WorldBoxGeometry(0.65, 0.06, 1.7), chairMat);
    base.position.set(0, 0.22, 0);
    chair.add(base);
    
    // Respaldo (Pivoteado en el borde para que no flote)
    const backGroup = new THREE.Group();
    const back = new THREE.Mesh(new WorldBoxGeometry(0.65, 0.06, 0.8), chairMat);
    back.position.set(0, 0, 0.35); // Mitad del largo del respaldo
    backGroup.add(back);
    
    // Almohada
    const pillow = new THREE.Mesh(new WorldBoxGeometry(0.5, 0.08, 0.2), chairMat);
    pillow.position.set(0, 0.06, 0.6);
    backGroup.add(pillow);

    backGroup.position.set(0, 0.25, 0.8); // En el borde de la base
    backGroup.rotation.x = -Math.PI / 10; // Ángulo más abierto/tumbado
    chair.add(backGroup);
    
    // Patas de la reposera
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.22);
    [[-0.25, -0.6], [0.25, -0.6], [-0.25, 0.6], [0.25, 0.6]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, 0.11, lz);
      chair.add(leg);
    });
    
    chair.position.set(chairX, 0.05, chairZ);
    chair.rotation.y = Math.PI / 2; // Invertidas (mirando hacia afuera)
    scene.add(chair);
  }

  // Mesita entre las reposeras
  const tableMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  const table = new THREE.Mesh(new WorldBoxGeometry(0.5, 0.35, 0.5), tableMat);
  const tableX = chairX;
  const tableZ = poolZ + 0.05;
  table.position.set(tableX, 0.175 + 0.05, tableZ);
  scene.add(table);

  // Drinks (Vasos con color)
  const drinkColors = ['#ff3300', '#00ccff'];
  for (let j = 0; j < 2; j++) {
     const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.15, 8), new THREE.MeshStandardMaterial({ color: drinkColors[j], transparent: true, opacity: 0.7 }));
     glass.position.set(tableX - 0.1 + j * 0.2, 0.45, tableZ);
     scene.add(glass);
  }
  
  // Sombrilla mejorada, más baja y color celeste oscuro opaco
  const poleMat = new THREE.MeshStandardMaterial({ color: '#444444', metalness: 0.6 });
  const fabricMat = new THREE.MeshStandardMaterial({ color: '#2c5d7a', roughness: 1.0 }); // Celeste oscuro opaco
  
  const umbrellaX = chairX + 1.2;
  const umbrellaZ = poolZ + 0.05;
  
  const umbrellaGroup = new THREE.Group();
  
  // Base pesada de la sombrilla
  const umbrellaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.1, 12), poleMat);
  umbrellaBase.position.set(0, 0.05, 0);
  umbrellaGroup.add(umbrellaBase);
  
  // Poste (Más bajo)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0), poleMat);
  pole.position.set(0, 1.0, 0);
  umbrellaGroup.add(pole);
  
  // Tela (Forma de cono más natural)
  const fabric = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.6, 16), fabricMat);
  fabric.position.set(0, 1.85, 0);
  umbrellaGroup.add(fabric);
  
  umbrellaGroup.position.set(umbrellaX, 0.05, umbrellaZ);
  scene.add(umbrellaGroup);
}

function addQuincho(
  scene: THREE.Scene,
  houseMinX: number, houseMaxX: number,
  houseMinZ: number, houseMaxZ: number,
  garages: number,
  wireframe: boolean
) {
  const qW = 6.0;
  const qD = 4.0;
  const qH = 2.6;
  
  let qX, qZ;
  
  if (garages > 0) {
    // Pegado a la pared trasera del garage
    const garageW = 4.0;
    const garageD = 6.0;
    const garZ = houseMinZ + (houseMaxZ - houseMinZ) / 2 - garageD / 2;
    qX = houseMaxX + (garages * 4.2) - qW;
    qZ = garZ - qD;
  } else {
    // Pegado a la pared trasera de la casa
    qX = (houseMinX + houseMaxX) / 2 - qW / 2;
    qZ = houseMinZ - qD;
  }
  
  const quinchoGroup = new THREE.Group();
  
  // Piso de piedra/ladrillo rústico
  const floorMat = new THREE.MeshStandardMaterial({ color: '#795548', roughness: 0.9 });
  const floor = new THREE.Mesh(new WorldBoxGeometry(qW, 0.08, qD), floorMat);
  floor.position.set(qW/2, 0.04, qD/2);
  quinchoGroup.add(floor);
  
  // Columnas (SÓLO 2 EXTERIORES, ya que es una extensión que se apoya en la casa)
  const woodMat = new THREE.MeshStandardMaterial({ color: '#3e2723', roughness: 1 });
  [[0.15, 0.15], [qW-0.15, 0.15]].forEach(([cx, cz]) => {
    const col = new THREE.Mesh(new WorldBoxGeometry(0.2, qH, 0.2), woodMat);
    col.position.set(cx, qH/2, cz);
    quinchoGroup.add(col);
  });
  
  // Techo liviano (Extensión de la casa)
  const roofMat = new THREE.MeshStandardMaterial({ color: '#2b1d16', roughness: 0.8 });
  const roof = new THREE.Mesh(new WorldBoxGeometry(qW + 0.1, 0.12, qD), roofMat);
  roof.position.set(qW/2, qH, qD/2);
  quinchoGroup.add(roof);
  
  // --- PARRILLA CONTRA LA PARED ---
  const brickMat = new THREE.MeshStandardMaterial({ color: '#a03010', roughness: 1 }); 
  const pW = 1.8, pD = 0.8, pH = 1.2;
  // Posicionada contra la pared de la casa (Z máximo local)
  const baseParrilla = new THREE.Mesh(new WorldBoxGeometry(pW, pH, pD), brickMat);
  baseParrilla.position.set(qW - pW/2 - 0.5, pH/2, qD - pD/2);
  quinchoGroup.add(baseParrilla);
  
  // Hueco de la parrilla (mirando hacia afuera de la pared)
  const hole = new THREE.Mesh(new WorldBoxGeometry(1.2, 0.5, 0.3), new THREE.MeshStandardMaterial({ color: '#111' }));
  hole.position.set(qW - pW/2 - 0.5, 0.8, qD - pD + 0.15);
  quinchoGroup.add(hole);
  
  // Chimenea/Campana (Pegada a la pared)
  const chimney = new THREE.Mesh(new WorldBoxGeometry(0.6, 1.8, 0.6), brickMat);
  chimney.position.set(qW - pW/2 - 0.5, pH + 0.9, qD - 0.3);
  quinchoGroup.add(chimney);
  
  // Mesa larga y bancos (Desplazados hacia el centro)
  const table = new THREE.Mesh(new WorldBoxGeometry(2.5, 0.1, 0.9), woodMat);
  table.position.set(qW/2 - 0.5, 0.8, qD/2 - 0.4);
  quinchoGroup.add(table);
  
  [0.5, -0.5].forEach(offsetZ => {
    const bench = new THREE.Mesh(new WorldBoxGeometry(2.5, 0.08, 0.25), woodMat);
    bench.position.set(qW/2 - 0.5, 0.45, qD/2 - 0.4 + offsetZ);
    quinchoGroup.add(bench);
  });
  
  quinchoGroup.position.set(qX, 0.05, qZ);
  scene.add(quinchoGroup);
}

// Generates posiciones pegadas según la disposición
function getAmbientesPos(
  plantas: number,
  config: CasaBuilderConfig
): (AmbienteEditable & { planta: number })[] {
  let alturaAcumulada = 0;
  const result: (AmbienteEditable & { planta: number })[] = [];
  for (let p = 0; p < config.plantas; p++) {
    const ambientesPlanta = config.ambientes.filter((a: AmbienteEditable & { planta: number }) => a.planta === p);
    const disp = config.distribuciones[p];
    let posiciones: (AmbienteEditable & { planta: number })[] = [];
    if (disp === "fila") {
      let x = 0;
      ambientesPlanta.forEach((a: AmbienteEditable & { planta: number }) => {
        posiciones.push({ ...a, origen: [x, alturaAcumulada, 0] as [number, number, number] });
        x += a.dimensiones[0];
      });
    } else if (disp === "cuadricula") {
      const { rows, cols } = getGrid(ambientesPlanta.length);
      let idx = 0;
      let maxAncho = Math.max(...ambientesPlanta.map((a: AmbienteEditable & { planta: number }) => a.dimensiones[0]));
      let maxLargo = Math.max(...ambientesPlanta.map((a: AmbienteEditable & { planta: number }) => a.dimensiones[2]));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (idx >= ambientesPlanta.length) break;
          const a = ambientesPlanta[idx];
          posiciones.push({ ...a, origen: [c * maxAncho, alturaAcumulada, r * maxLargo] as [number, number, number] });
          idx++;
        }
      }
    } else if (disp === "l" && ambientesPlanta.length >= 3) {
      let x = 0;
      posiciones.push({ ...ambientesPlanta[0], origen: [x, alturaAcumulada, 0] as [number, number, number] });
      x += ambientesPlanta[0].dimensiones[0];
      posiciones.push({ ...ambientesPlanta[1], origen: [x, alturaAcumulada, 0] as [number, number, number] });
      let z = ambientesPlanta[1].dimensiones[2];
      for (let i = 2; i < ambientesPlanta.length; i++) {
        posiciones.push({ ...ambientesPlanta[i], origen: [x, alturaAcumulada, z] as [number, number, number] });
        z += ambientesPlanta[i].dimensiones[2];
      }
    } else if (disp === "u" && ambientesPlanta.length >= 4) {
      let x = 0;
      posiciones.push({ ...ambientesPlanta[0], origen: [x, alturaAcumulada, 0] as [number, number, number] });
      x += ambientesPlanta[0].dimensiones[0];
      posiciones.push({ ...ambientesPlanta[1], origen: [x, alturaAcumulada, 0] as [number, number, number] });
      let z = ambientesPlanta[1].dimensiones[2];
      posiciones.push({ ...ambientesPlanta[2], origen: [x, alturaAcumulada, z] as [number, number, number] });
      let x2 = x - ambientesPlanta[3].dimensiones[0];
      posiciones.push({ ...ambientesPlanta[3], origen: [x2, alturaAcumulada, z] as [number, number, number] });
      for (let i = 4; i < ambientesPlanta.length; i++) {
        x2 += ambientesPlanta[i].dimensiones[0];
        posiciones.push({ ...ambientesPlanta[i], origen: [x2, alturaAcumulada, z] as [number, number, number] });
      }
    }
    result.push(...posiciones);
    const alturaPlanta = ambientesPlanta.reduce((max: number, a: AmbienteEditable & { planta: number }) => Math.max(max, a.dimensiones[1]), 0) || 0;
    alturaAcumulada += alturaPlanta;
  }
  return result;
}

// Dibuja solo paredes (no cubos sólidos), evitando duplicados
function addParedes(
  scene: THREE.Scene,
  ambientes: (AmbienteEditable & { planta: number })[],
  wallMaterial: THREE.MeshStandardMaterial,
  wireframeMode: boolean = false,
  doorStyle: string = 'moderna'
) {
  const paredesSet = new Set();
  const TOL = 0.05; // tolerancia para comparar posiciones
  // --- VARIABLES DE PUERTAS INTERIORES (scope global de la función) ---
  const puertaAncho = 0.9;
  const puertaAlto = 2.05;
  const puertaProf = 0.05;
  const puertasInteriores: Array<{ tipo: string, pared: any, puertaX: number, puertaY: number, puertaZ: number, ambiente: any, ambiente2: any }> = [];

  // --- Nueva lógica para puerta exterior ---
  // Buscar ambiente de planta 0 con pared exterior (preferentemente frontal)
  const ambientesPlanta0 = ambientes.filter(a => a.planta === 0);
  let puertaExterior: null | { ambiente: any, tipo: string } = null;
  for (const a of ambientesPlanta0) {
    const [x, y, z] = a.origen;
    const [dx, dy, dz] = a.dimensiones;
    // Chequear si la pared frontal (z+dz) es exterior
    let esExterior = true;
    for (const b of ambientesPlanta0) {
      if (a === b) continue;
      // Si hay otro ambiente pegado a la pared frontal
      if (
        Math.abs((z + dz) - b.origen[2]) < TOL &&
        x < b.origen[0] + b.dimensiones[0] &&
        x + dx > b.origen[0]
      ) {
        esExterior = false;
        break;
      }
    }
    if (esExterior) {
      puertaExterior = { ambiente: a, tipo: 'frente' };
      break;
    }
  }
  // Si no hay frontal, buscar izquierda
  if (!puertaExterior) {
    for (const a of ambientesPlanta0) {
      const [x, y, z] = a.origen;
      const [dx, dy, dz] = a.dimensiones;
      let esExterior = true;
      for (const b of ambientesPlanta0) {
        if (a === b) continue;
        if (
          Math.abs(x - (b.origen[0] + b.dimensiones[0])) < TOL &&
          z < b.origen[2] + b.dimensiones[2] &&
          z + dz > b.origen[2]
        ) {
          esExterior = false;
          break;
        }
      }
      if (esExterior) {
        puertaExterior = { ambiente: a, tipo: 'izq' };
        break;
      }
    }
  }
  // Si no hay izquierda, buscar derecha
  if (!puertaExterior) {
    for (const a of ambientesPlanta0) {
      const [x, y, z] = a.origen;
      const [dx, dy, dz] = a.dimensiones;
      let esExterior = true;
      for (const b of ambientesPlanta0) {
        if (a === b) continue;
        if (
          Math.abs((x + dx) - b.origen[0]) < TOL &&
          z < b.origen[2] + b.dimensiones[2] &&
          z + dz > b.origen[2]
        ) {
          esExterior = false;
          break;
        }
      }
      if (esExterior) {
        puertaExterior = { ambiente: a, tipo: 'der' };
        break;
      }
    }
  }
  // Si no hay derecha, buscar fondo
  if (!puertaExterior) {
    for (const a of ambientesPlanta0) {
      const [x, y, z] = a.origen;
      const [dx, dy, dz] = a.dimensiones;
      let esExterior = true;
      for (const b of ambientesPlanta0) {
        if (a === b) continue;
        if (
          Math.abs(z - (b.origen[2] + b.dimensiones[2])) < TOL &&
          x < b.origen[0] + b.dimensiones[0] &&
          x + dx > b.origen[0]
        ) {
          esExterior = false;
          break;
        }
      }
      if (esExterior) {
        puertaExterior = { ambiente: a, tipo: 'fondo' };
        break;
      }
    }
  }
  // Fallback: usar el primero como antes
  if (!puertaExterior && ambientesPlanta0.length > 0) {
    puertaExterior = { ambiente: ambientesPlanta0[0], tipo: 'frente' };
  }

  // --- FIN nueva lógica puerta exterior ---

  // --- VIGAS Y COLUMNAS PARA TODAS LAS PLANTAS ---
  const vigaSize = 0.18;
  const vigaColor = '#bca16a';
  const vigaMaterial = new THREE.MeshStandardMaterial({ color: vigaColor, wireframe: wireframeMode, transparent: wireframeMode, opacity: wireframeMode ? 0.3 : 1 });
  // Agrupar ambientes por planta
  const ambientesPorPlanta: Record<number, (AmbienteEditable & { planta: number })[]> = {};
  ambientes.forEach(a => {
    if (!ambientesPorPlanta[a.planta]) ambientesPorPlanta[a.planta] = [];
    ambientesPorPlanta[a.planta].push(a);
  });
  Object.entries(ambientesPorPlanta).forEach(([plantaStr, ambientesPlanta]) => {
    const planta = Number(plantaStr);
    if (ambientesPlanta.length === 0) return;
    // Calcular bounding box de la planta
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity;
    ambientesPlanta.forEach(a => {
      const [x, y, z] = a.origen;
      const [dx, dy, dz] = a.dimensiones;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + dx);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z + dz);
      maxY = Math.max(maxY, y + dy);
    });
    // Altura de vigas de esta planta
    const vigaAlturaPlanta = maxY;
    // Esquinas exteriores
    const esquinasVigas: [number, number][] = [
      [minX + vigaSize / 2, minZ + vigaSize / 2],
      [minX + vigaSize / 2, maxZ - vigaSize / 2],
      [maxX - vigaSize / 2, minZ + vigaSize / 2],
      [maxX - vigaSize / 2, maxZ - vigaSize / 2],
    ];
    esquinasVigas.forEach(([vx, vz]) => {
      const viga = new THREE.Mesh(
        new WorldBoxGeometry(vigaSize, vigaAlturaPlanta, vigaSize),
        vigaMaterial
      );
      viga.position.set(vx, vigaAlturaPlanta / 2, vz);
      scene.add(viga);
    });
    // --- VIGAS INTERIORES EN INTERSECCIONES ---
    const TOL_INTERIOR = 0.01;
    const vertices: { [key: string]: { x: number, z: number, count: number } } = {};
    ambientesPlanta.forEach(a => {
      const [x, , z] = a.origen;
      const [dx, , dz] = a.dimensiones;
      const puntos = [
        [x, z],
        [x + dx, z],
        [x, z + dz],
        [x + dx, z + dz],
      ];
      puntos.forEach(([vx, vz]) => {
        const key = `${Math.round(vx / TOL_INTERIOR) * TOL_INTERIOR}_${Math.round(vz / TOL_INTERIOR) * TOL_INTERIOR}`;
        if (!vertices[key]) vertices[key] = { x: vx, z: vz, count: 0 };
        vertices[key].count++;
      });
    });
    Object.values(vertices).forEach(({ x: vx, z: vz, count }) => {
      const esEsquinaExterior = esquinasVigas.some(([ex, ez]) => Math.abs(ex - vx) < vigaSize && Math.abs(ez - vz) < vigaSize);
      if (count >= 2 && !esEsquinaExterior) {
        const viga = new THREE.Mesh(
          new WorldBoxGeometry(vigaSize, vigaAlturaPlanta, vigaSize),
          vigaMaterial
        );
        viga.position.set(vx, vigaAlturaPlanta / 2, vz);
        scene.add(viga);
      }
    });
    // --- COLUMNAS INTERIORES EN GRILLA ---
    for (let i = 0; i < ambientesPlanta.length; i++) {
      const a = ambientesPlanta[i];
      const [x, , z] = a.origen;
      const [dx, , dz] = a.dimensiones;
      const maxDist = 5;
      if (dx <= maxDist && dz <= maxDist) continue;
      const nColX = dx > maxDist ? Math.ceil(dx / maxDist) + 1 : 1;
      const nColZ = dz > maxDist ? Math.ceil(dz / maxDist) + 1 : 1;
      if (nColX < 1 || nColZ < 1 || dx <= 0 || dz <= 0) continue;
      for (let ix = 0; ix < nColX; ix++) {
        for (let iz = 0; iz < nColZ; iz++) {
          let px = nColX === 1 ? x + dx / 2 : x + (dx * ix) / (nColX - 1);
          let pz = nColZ === 1 ? z + dz / 2 : z + (dz * iz) / (nColZ - 1);
          const esEsquinaExterior = esquinasVigas.some(([ex, ez]) => Math.abs(ex - px) < vigaSize && Math.abs(ez - pz) < vigaSize);
          let esInterseccion = false;
          if (vertices && typeof vertices === 'object') {
            esInterseccion = Object.values(vertices).some(v => Math.abs(v.x - px) < vigaSize && Math.abs(v.z - pz) < vigaSize && v.count >= 2);
          }
          // --- EVITAR COLUMNAS EN HUECOS DE PUERTAS ---
          let enHuecoPuerta = false;
          // Puerta exterior solo en planta 0
          if (planta === 0 && puertaExterior && puertaExterior.ambiente === a) {
            const [ax, ay, az] = a.origen;
            const [adx, ady, adz] = a.dimensiones;
            let puertaX = 0, puertaZ = 0;
            if (puertaExterior.tipo === 'frente' || puertaExterior.tipo === 'fondo') {
              puertaX = ax + adx / 2 - puertaAncho / 2;
              puertaZ = puertaExterior.tipo === 'frente' ? az + adz - puertaProf : az;
              if (
                Math.abs(pz - puertaZ) < vigaSize &&
                px >= puertaX - vigaSize / 2 && px <= puertaX + puertaAncho + vigaSize / 2
              ) {
                enHuecoPuerta = true;
                if (px < puertaX + puertaAncho / 2) {
                  if (puertaX - vigaSize > x) px = puertaX - vigaSize / 2;
                  else continue;
                } else {
                  if (puertaX + puertaAncho + vigaSize < ax + adx) px = puertaX + puertaAncho + vigaSize / 2;
                  else continue;
                }
              }
            } else if (puertaExterior.tipo === 'izq' || puertaExterior.tipo === 'der') {
              puertaZ = az + adz / 2 - puertaAncho / 2;
              puertaX = puertaExterior.tipo === 'izq' ? ax : ax + adx - puertaProf;
              if (
                Math.abs(px - puertaX) < vigaSize &&
                pz >= puertaZ - vigaSize / 2 && pz <= puertaZ + puertaAncho + vigaSize / 2
              ) {
                enHuecoPuerta = true;
                if (pz < puertaZ + puertaAncho / 2) {
                  if (puertaZ - vigaSize > z) pz = puertaZ - vigaSize / 2;
                  else continue;
                } else {
                  if (puertaZ + puertaAncho + vigaSize < az + adz) pz = puertaZ + puertaAncho + vigaSize / 2;
                  else continue;
                }
              }
            }
          }
          // Puertas interiores (huecos en paredes compartidas)
          if (Array.isArray(puertasInteriores)) {
            for (const pi of puertasInteriores) {
              if (pi.ambiente === a) {
                if (pi.tipo === 'izq' || pi.tipo === 'der') {
                  if (
                    Math.abs(px - pi.puertaX) < vigaSize &&
                    pz >= pi.puertaZ - vigaSize / 2 && pz <= pi.puertaZ + puertaAncho + vigaSize / 2
                  ) {
                    enHuecoPuerta = true;
                    if (pz < pi.puertaZ + puertaAncho / 2) {
                      if (pi.puertaZ - vigaSize > z) pz = pi.puertaZ - vigaSize / 2;
                      else continue;
                    } else {
                      if (pi.puertaZ + puertaAncho + vigaSize < z + dz) pz = pi.puertaZ + puertaAncho + vigaSize / 2;
                      else continue;
                    }
                  }
                } else if (pi.tipo === 'fondo' || pi.tipo === 'frente') {
                  if (
                    Math.abs(pz - pi.puertaZ) < vigaSize &&
                    px >= pi.puertaX - vigaSize / 2 && px <= pi.puertaX + puertaAncho + vigaSize / 2
                  ) {
                    enHuecoPuerta = true;
                    if (px < pi.puertaX + puertaAncho / 2) {
                      if (pi.puertaX - vigaSize > x) px = pi.puertaX - vigaSize / 2;
                      else continue;
                    } else {
                      if (pi.puertaX + puertaAncho + vigaSize < x + dx) px = pi.puertaX + puertaAncho + vigaSize / 2;
                      else continue;
                    }
                  }
                }
              }
            }
          }
          if (!esEsquinaExterior && !esInterseccion) {
            const viga = new THREE.Mesh(
              new WorldBoxGeometry(vigaSize, vigaAlturaPlanta, vigaSize),
              vigaMaterial
            );
            viga.position.set(px, vigaAlturaPlanta / 2, pz);
            scene.add(viga);
          }
        }
      }
    }
    // --- VIGAS HORIZONTALES ENTRE COLUMNAS ---
    const columnasPos: [number, number][] = [];
    if (Array.isArray(esquinasVigas)) {
      columnasPos.push(...esquinasVigas);
    }
    for (let i = 0; i < ambientesPlanta.length; i++) {
      const a = ambientesPlanta[i];
      const [x, , z] = a.origen;
      const [dx, , dz] = a.dimensiones;
      const maxDist = 5;
      if (dx <= maxDist && dz <= maxDist) continue;
      const nColX = dx > maxDist ? Math.ceil(dx / maxDist) + 1 : 1;
      const nColZ = dz > maxDist ? Math.ceil(dz / maxDist) + 1 : 1;
      for (let ix = 0; ix < nColX; ix++) {
        for (let iz = 0; iz < nColZ; iz++) {
          let px = nColX === 1 ? x + dx / 2 : x + (dx * ix) / (nColX - 1);
          let pz = nColZ === 1 ? z + dz / 2 : z + (dz * iz) / (nColZ - 1);
          const esEsquinaExterior = esquinasVigas.some(([ex, ez]) => Math.abs(ex - px) < vigaSize && Math.abs(ez - pz) < vigaSize);
          if (!esEsquinaExterior) {
            columnasPos.push([px, pz]);
          }
        }
      }
    }
    for (let i = 0; i < columnasPos.length; i++) {
      const [x1, z1] = columnasPos[i];
      for (let j = i + 1; j < columnasPos.length; j++) {
        const [x2, z2] = columnasPos[j];
        if (Math.abs(z1 - z2) < vigaSize * 1.5 && Math.abs(x1 - x2) > vigaSize * 1.5) {
          const largo = Math.abs(x2 - x1);
          const geometry = new WorldBoxGeometry(largo, vigaSize, vigaSize);
          const material = vigaMaterial;
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set((x1 + x2) / 2, vigaAlturaPlanta, z1);
          scene.add(mesh);
        }
        if (Math.abs(x1 - x2) < vigaSize * 1.5 && Math.abs(z1 - z2) > vigaSize * 1.5) {
          const largo = Math.abs(z2 - z1);
          const geometry = new WorldBoxGeometry(vigaSize, vigaSize, largo);
          const material = vigaMaterial;
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x1, vigaAlturaPlanta, (z1 + z2) / 2);
          scene.add(mesh);
        }
      }
    }

    // --- GENERAR PUERTAS INTERIORES PARA TODAS LAS PLANTAS ---
    puertasInteriores.length = 0; // Limpiar si ya había
    Object.values(ambientesPorPlanta).forEach(ambs => {
      for (let i = 0; i < ambs.length; i++) {
        const a = ambs[i];
        for (let j = i + 1; j < ambs.length; j++) {
          const b = ambs[j];
          // Izquierda/derecha
          if (
            Math.abs(a.origen[0] - (b.origen[0] + b.dimensiones[0])) < TOL ||
            Math.abs((a.origen[0] + a.dimensiones[0]) - b.origen[0]) < TOL
          ) {
            // Chequear si se solapan en Y y Z
            const ySolapa =
              a.origen[1] < b.origen[1] + b.dimensiones[1] &&
              a.origen[1] + a.dimensiones[1] > b.origen[1];
            const zSolapa =
              a.origen[2] < b.origen[2] + b.dimensiones[2] &&
              a.origen[2] + a.dimensiones[2] > b.origen[2];
            if (ySolapa && zSolapa) {
              // Pared compartida: poner puerta centrada en Z
              const zPuerta = Math.max(a.origen[2], b.origen[2]) + Math.min(a.dimensiones[2], b.dimensiones[2]) / 2 - puertaAncho / 2;
              const yPuerta = Math.max(a.origen[1], b.origen[1]);
              puertasInteriores.push({
                tipo: a.origen[0] > b.origen[0] ? 'izq' : 'der',
                pared: {
                  x: a.origen[0] > b.origen[0] ? a.origen[0] : a.origen[0] + a.dimensiones[0],
                  y: yPuerta,
                  z: Math.max(a.origen[2], b.origen[2]),
                  dy: Math.max(a.dimensiones[1], b.dimensiones[1]),
                  dz: Math.min(a.dimensiones[2], b.dimensiones[2])
                },
                puertaX: a.origen[0] > b.origen[0] ? a.origen[0] : a.origen[0] + a.dimensiones[0],
                puertaY: yPuerta,
                puertaZ: zPuerta,
                ambiente: a,
                ambiente2: b
              });
            }
          }
          // Fondo/frente
          if (
            Math.abs(a.origen[2] - (b.origen[2] + b.dimensiones[2])) < TOL ||
            Math.abs((a.origen[2] + a.dimensiones[2]) - b.origen[2]) < TOL
          ) {
            // Chequear si se solapan en Y y X
            const ySolapa =
              a.origen[1] < b.origen[1] + b.dimensiones[1] &&
              a.origen[1] + a.dimensiones[1] > b.origen[1];
            const xSolapa =
              a.origen[0] < b.origen[0] + b.dimensiones[0] &&
              a.origen[0] + a.dimensiones[0] > b.origen[0];
            if (ySolapa && xSolapa) {
              // Pared compartida: poner puerta centrada en X
              const xPuerta = Math.max(a.origen[0], b.origen[0]) + Math.min(a.dimensiones[0], b.dimensiones[0]) / 2 - puertaAncho / 2;
              const yPuerta = Math.max(a.origen[1], b.origen[1]);
              puertasInteriores.push({
                tipo: a.origen[2] > b.origen[2] ? 'fondo' : 'frente',
                pared: {
                  z: a.origen[2] > b.origen[2] ? a.origen[2] : a.origen[2] + a.dimensiones[2],
                  y: yPuerta,
                  x: Math.max(a.origen[0], b.origen[0]),
                  dy: Math.max(a.dimensiones[1], b.dimensiones[1]),
                  dx: Math.min(a.dimensiones[0], b.dimensiones[0])
                },
                puertaX: xPuerta,
                puertaY: yPuerta,
                puertaZ: a.origen[2] > b.origen[2] ? a.origen[2] : a.origen[2] + a.dimensiones[2],
                ambiente: a,
                ambiente2: b
              });
            }
          }
        }
      }
    });

    // --- SÍMBOLOS Y DETALLES 3D PARA PUERTAS ---
    const add3DDoor = (px: number, py: number, pz: number, isZAxis: boolean, isExterior: boolean) => {
      if (scene.userData.isTechnical) return;
      const dWidth = 0.9;
      const dHeight = 2.05;
      const dThick = 0.05;
      
      const doorGroup = new THREE.Group();
      doorGroup.position.set(
        isZAxis ? px + 0.025 : px + dWidth / 2, 
        py + dHeight / 2, 
        isZAxis ? pz + dWidth / 2 : pz + 0.025
      );
      if (isZAxis) doorGroup.rotation.y = Math.PI / 2;

      const style = doorStyle;
      
      if (style === 'moderna') {
        const leafMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.6 });
        const leaf = new THREE.Mesh(new WorldBoxGeometry(0.65, dHeight, dThick), leafMat);
        leaf.position.x = -0.125;
        doorGroup.add(leaf);
        
        const glassMat = new THREE.MeshStandardMaterial({ color: '#e0e0e0', transparent: true, opacity: 0.7, roughness: 0.2 });
        const glass = new THREE.Mesh(new WorldBoxGeometry(0.2, dHeight - 0.1, dThick - 0.01), glassMat);
        glass.position.x = 0.325;
        doorGroup.add(glass);
        
        const handleMat = new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 1, roughness: 0.2 });
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2), handleMat);
        handle.position.set(0.15, 0, dThick);
        doorGroup.add(handle);
        
        for(let i=0; i<3; i++) {
           const strip = new THREE.Mesh(new WorldBoxGeometry(0.65, 0.02, dThick+0.01), handleMat);
           strip.position.set(-0.125, -0.4 + i*0.4, 0);
           doorGroup.add(strip);
        }
      } else if (style === 'madera_vidrio') {
        const woodMat = new THREE.MeshStandardMaterial({ color: '#5c3a21', roughness: 0.8 });
        const leaf = new THREE.Mesh(new WorldBoxGeometry(dWidth, dHeight, dThick), woodMat);
        doorGroup.add(leaf);
        
        const glassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 });
        for(let i=0; i<4; i++) {
           const glass = new THREE.Mesh(new WorldBoxGeometry(0.6, 0.1, dThick+0.01), glassMat);
           glass.position.set(0, -0.6 + i*0.4, 0);
           doorGroup.add(glass);
        }
        
        const handleMat = new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 0.8 });
        const handle = new THREE.Mesh(new WorldBoxGeometry(0.02, 0.4, 0.04), handleMat);
        handle.position.set(-0.35, 0, dThick);
        doorGroup.add(handle);
      } else if (style === 'colonial') {
        const blueMat = new THREE.MeshStandardMaterial({ color: '#2b3e50', roughness: 0.5 });
        const leaf = new THREE.Mesh(new WorldBoxGeometry(dWidth, dHeight, dThick), blueMat);
        doorGroup.add(leaf);
        
        const panelMat = new THREE.MeshStandardMaterial({ color: '#1a2a3a', roughness: 0.5 });
        const p1 = new THREE.Mesh(new WorldBoxGeometry(0.2, 0.6, dThick+0.01), panelMat);
        p1.position.set(-0.25, -0.5, 0); doorGroup.add(p1);
        const p2 = new THREE.Mesh(new WorldBoxGeometry(0.2, 0.6, dThick+0.01), panelMat);
        p2.position.set(0.25, -0.5, 0); doorGroup.add(p2);
        
        const glassMat = new THREE.MeshStandardMaterial({ color: '#aaccff', transparent: true, opacity: 0.5 });
        const glassGroup = new THREE.Group();
        const gRect = new THREE.Mesh(new WorldBoxGeometry(0.3, 0.8, dThick+0.01), glassMat);
        glassGroup.add(gRect);
        const gArch = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, dThick+0.01, 16, 1, false, 0, Math.PI), glassMat);
        gArch.rotation.x = Math.PI/2;
        gArch.position.y = 0.4;
        glassGroup.add(gArch);
        glassGroup.position.set(0, 0.2, 0);
        doorGroup.add(glassGroup);
        
        const handleMat = new THREE.MeshStandardMaterial({ color: '#b5a642', metalness: 0.8, roughness: 0.3 });
        const handle = new THREE.Mesh(new THREE.SphereGeometry(0.04), handleMat);
        handle.position.set(0.35, -0.1, dThick);
        doorGroup.add(handle);
      } else {
        const darkMat = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.3 });
        const leaf = new THREE.Mesh(new WorldBoxGeometry(dWidth, dHeight, dThick), darkMat);
        doorGroup.add(leaf);
        
        const grooveMat = new THREE.MeshStandardMaterial({ color: '#111111' });
        for(let i=0; i<4; i++) {
           const groove = new THREE.Mesh(new WorldBoxGeometry(dWidth+0.001, 0.01, dThick+0.005), grooveMat);
           groove.position.set(0, -0.6 + i*0.4, 0);
           doorGroup.add(groove);
        }
        
        const handleMat = new THREE.MeshStandardMaterial({ color: '#aaaaaa', metalness: 0.9, roughness: 0.2 });
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8), handleMat);
        handle.position.set(-0.35, 0, dThick);
        doorGroup.add(handle);
      }
      scene.add(doorGroup);
    };

    // --- DIBUJAR PAREDES Y PUERTAS PARA TODOS LOS AMBIENTES ---
    ambientes.forEach((a: AmbienteEditable & { planta: number }) => {
    const [x, y, z] = a.origen;
    const [dx, dy, dz] = a.dimensiones;
    // Cada pared: identificador único por posición y orientación
    const paredes = [
        { key: `x0_${x}_${y}_${z}_${dy}_${dz}`, pos: [x, y, z], size: [0.05, dy, dz], rot: [0, 0, 0], tipo: 'izq' }, // izquierda
        { key: `x1_${x+dx}_${y}_${z}_${dy}_${dz}`, pos: [x+dx, y, z], size: [0.05, dy, dz], rot: [0, 0, 0], tipo: 'der' }, // derecha
        { key: `z0_${x}_${y}_${z}_${dx}_${dy}`, pos: [x, y, z], size: [dx, dy, 0.05], rot: [0, 0, 0], tipo: 'fondo' }, // fondo
        { key: `z1_${x}_${y}_${z+dz}_${dx}_${dy}`, pos: [x, y, z+dz], size: [dx, dy, 0.05], rot: [0, 0, 0], tipo: 'frente' }, // frente
    ];
    paredes.forEach(p => {
        const isTechnical = scene.userData.isTechnical;
        const dx = p.size[0];
        const dy = isTechnical ? Math.min(p.size[1], 1.1) : p.size[1];
        const dz = p.size[2];
        const x = p.pos[0];
        const y = p.pos[1];
        const z = p.pos[2];

        const resolvedMaterial = (p as any).material || wallMaterial;
        // --- Puerta exterior: dejar hueco solo en la pared seleccionada ---
        if (
          puertaExterior &&
          a === puertaExterior.ambiente &&
          p.tipo === puertaExterior.tipo
        ) {
          // Parámetros de la puerta exterior
          const puertaX = p.tipo === 'frente' || p.tipo === 'fondo'
            ? x + dx / 2 - 0.9 / 2
            : (p.tipo === 'izq' ? x : x + dx - 0.05);
          const puertaY = y;
          const puertaZ = p.tipo === 'frente' ? z + dz - 0.05 : (p.tipo === 'fondo' ? z : (p.tipo === 'izq' || p.tipo === 'der' ? z + dz / 2 - 0.9 / 2 : z));
          // Paredes a los lados y dintel
          if (p.tipo === 'frente' || p.tipo === 'fondo') {
            // Izquierda
            if (puertaX > x) {
              const geometryIzq = new WorldBoxGeometry(puertaX - x, dy, 0.05, 1, 1, 1, [x, y, p.pos[2]]);
              const materialIzq = wallMaterial;
              const meshIzq = new THREE.Mesh(geometryIzq, materialIzq);
              meshIzq.position.set(x + (puertaX - x) / 2, y + dy / 2, p.pos[2] + 0.05 / 2);
              scene.add(meshIzq);
            }
            // Derecha
            const derX = puertaX + 0.9;
            if (derX < x + dx) {
              const geometryDer = new WorldBoxGeometry((x + dx) - derX, dy, 0.05, 1, 1, 1, [derX, y, p.pos[2]]);
              const materialDer = wallMaterial;
              const meshDer = new THREE.Mesh(geometryDer, materialDer);
              meshDer.position.set(derX + ((x + dx) - derX) / 2, y + dy / 2, p.pos[2] + 0.05 / 2);
              scene.add(meshDer);
            }
            // Dintel
            if (2.05 < dy) {
              const geometryArriba = new WorldBoxGeometry(0.9, dy - 2.05, 0.05, 1, 1, 1, [puertaX, y + 2.05, p.pos[2]]);
              const materialArriba = wallMaterial;
              const meshArriba = new THREE.Mesh(geometryArriba, materialArriba);
              meshArriba.position.set(puertaX + 0.9 / 2, y + 2.05 + (dy - 2.05) / 2, p.pos[2] + 0.05 / 2);
              scene.add(meshArriba);
            }
          } else if (p.tipo === 'izq' || p.tipo === 'der') {
            // Abajo (segmento Z previo a la puerta)
            if (puertaZ > z) {
              const geometryAbajo = new WorldBoxGeometry(0.05, dy, puertaZ - z, 1, 1, 1, [p.pos[0], y, z]);
              const materialAbajo = wallMaterial;
              const meshAbajo = new THREE.Mesh(geometryAbajo, materialAbajo);
              meshAbajo.position.set(p.pos[0] + 0.05 / 2, y + dy / 2, z + (puertaZ - z) / 2);
              scene.add(meshAbajo);
            }
            // Arriba (segmento Z posterior a la puerta)
            const arribaZ = puertaZ + 0.9;
            if (arribaZ < z + dz) {
              const geometryArriba = new WorldBoxGeometry(0.05, dy, z + dz - arribaZ, 1, 1, 1, [p.pos[0], y, arribaZ]);
              const materialArriba = wallMaterial;
              const meshArriba = new THREE.Mesh(geometryArriba, materialArriba);
              meshArriba.position.set(p.pos[0] + 0.05 / 2, y + dy / 2, arribaZ + (z + dz - arribaZ) / 2);
              scene.add(meshArriba);
            }
            // Dintel (segmento sobre la puerta)
            if (2.05 < dy) {
              const geometryDintel = new WorldBoxGeometry(0.05, dy - 2.05, 0.9, 1, 1, 1, [p.pos[0], y + 2.05, puertaZ]);
              const materialDintel = wallMaterial;
              const meshDintel = new THREE.Mesh(geometryDintel, materialDintel);
              meshDintel.position.set(p.pos[0] + 0.05 / 2, y + 2.05 + (dy - 2.05) / 2, puertaZ + 0.9 / 2);
              scene.add(meshDintel);
            }
          }
          
          add3DDoor(puertaX, puertaY, puertaZ, p.tipo === 'izq' || p.tipo === 'der', true);
          
          // No dibujar la pared completa aquí (ya se dibujaron los segmentos)
          return;
        }
        // Si es una pared compartida con puerta interior, dejar hueco SOLO si este ambiente es el "primario"
        let puertaInterior = null;
        for (const pi of puertasInteriores) {
          // Solo el ambiente con menor origen (x, z, y) dibuja la pared compartida
          const isThisPrimary =
            (pi.ambiente === a &&
              ((p.tipo === 'izq' && a.origen[0] < pi.ambiente2.origen[0]) ||
               (p.tipo === 'der' && a.origen[0] + a.dimensiones[0] < pi.ambiente2.origen[0] + pi.ambiente2.dimensiones[0]) ||
               (p.tipo === 'fondo' && a.origen[2] < pi.ambiente2.origen[2]) ||
               (p.tipo === 'frente' && a.origen[2] + a.dimensiones[2] < pi.ambiente2.origen[2] + pi.ambiente2.dimensiones[2])
              )
            );
          if (
            ((p.tipo === 'izq' && Math.abs(p.pos[0] - pi.pared.x) < TOL && Math.abs(p.pos[1] - pi.pared.y) < TOL && Math.abs(p.pos[2] - pi.pared.z) < TOL && Math.abs(p.size[2] - pi.pared.dz) < TOL) ||
             (p.tipo === 'der' && Math.abs(p.pos[0] - pi.pared.x) < TOL && Math.abs(p.pos[1] - pi.pared.y) < TOL && Math.abs(p.pos[2] - pi.pared.z) < TOL && Math.abs(p.size[2] - pi.pared.dz) < TOL) ||
             (p.tipo === 'fondo' && Math.abs(p.pos[2] - pi.pared.z) < TOL && Math.abs(p.pos[1] - pi.pared.y) < TOL && Math.abs(p.pos[0] - pi.pared.x) < TOL && Math.abs(p.size[0] - pi.pared.dx) < TOL) ||
             (p.tipo === 'frente' && Math.abs(p.pos[2] - pi.pared.z) < TOL && Math.abs(p.pos[1] - pi.pared.y) < TOL && Math.abs(p.pos[0] - pi.pared.x) < TOL && Math.abs(p.size[0] - pi.pared.dx) < TOL))
            && isThisPrimary
          ) {
            puertaInterior = pi;
          }
        }
        if (puertaInterior) {
          // Dibujar segmentos de pared dejando hueco para la puerta
          if (p.tipo === 'izq' || p.tipo === 'der') {
            // Pared izquierda/derecha: puerta centrada en Z
            const z0 = z;
            const z1 = puertaInterior.puertaZ;
            const z2 = puertaInterior.puertaZ + puertaAncho;
            const z3 = z + dz;
            if (z1 > z0) {
              const geometryIzq = new WorldBoxGeometry(0.05, dy, z1 - z0, 1, 1, 1, [p.pos[0], y, z0]);
              const materialIzq = wallMaterial;
              const meshIzq = new THREE.Mesh(geometryIzq, materialIzq);
              meshIzq.position.set(p.pos[0] + 0.05 / 2, y + dy / 2, z0 + (z1 - z0) / 2);
              scene.add(meshIzq);
            }
            if (z3 > z2) {
              const geometryDer = new WorldBoxGeometry(0.05, dy, z3 - z2, 1, 1, 1, [p.pos[0], y, z2]);
              const materialDer = wallMaterial;
              const meshDer = new THREE.Mesh(geometryDer, materialDer);
              meshDer.position.set(p.pos[0] + 0.05 / 2, y + dy / 2, z2 + (z3 - z2) / 2);
              scene.add(meshDer);
            }
            // Segmento arriba de la puerta (dintel)
            if (puertaAlto < dy) {
              const geometryArriba = new WorldBoxGeometry(0.05, dy - puertaAlto, puertaAncho, 1, 1, 1, [p.pos[0], y + puertaAlto, z1]);
              const materialArriba = wallMaterial;
              const meshArriba = new THREE.Mesh(geometryArriba, materialArriba);
              meshArriba.position.set(p.pos[0] + 0.05 / 2, y + puertaAlto + (dy - puertaAlto) / 2, z1 + puertaAncho / 2);
              scene.add(meshArriba);
            }
          } else if (p.tipo === 'fondo' || p.tipo === 'frente') {
            // Pared fondo/frente: puerta centrada en X
            const x0 = x;
            const x1 = puertaInterior.puertaX;
            const x2 = puertaInterior.puertaX + puertaAncho;
            const x3 = x + dx;
            if (x1 > x0) {
              const geometryIzq = new WorldBoxGeometry(x1 - x0, dy, 0.05, 1, 1, 1, [x0, y, p.pos[2]]);
              const materialIzq = wallMaterial;
              const meshIzq = new THREE.Mesh(geometryIzq, materialIzq);
              meshIzq.position.set(x0 + (x1 - x0) / 2, y + dy / 2, p.pos[2] + 0.05 / 2);
              scene.add(meshIzq);
            }
            if (x3 > x2) {
              const geometryDer = new WorldBoxGeometry(x3 - x2, dy, 0.05, 1, 1, 1, [x2, y, p.pos[2]]);
              const materialDer = wallMaterial;
              const meshDer = new THREE.Mesh(geometryDer, materialDer);
              meshDer.position.set(x2 + (x3 - x2) / 2, y + dy / 2, p.pos[2] + 0.05 / 2);
              scene.add(meshDer);
            }
            // Segmento arriba de la puerta (dintel)
            if (puertaAlto < dy) {
              const geometryArriba = new WorldBoxGeometry(puertaAncho, dy - puertaAlto, 0.05, 1, 1, 1, [x1, y + puertaAlto, p.pos[2]]);
              const materialArriba = wallMaterial;
              const meshArriba = new THREE.Mesh(geometryArriba, materialArriba);
              meshArriba.position.set(x1 + puertaAncho / 2, y + puertaAlto + (dy - puertaAlto) / 2, p.pos[2] + 0.05 / 2);
              scene.add(meshArriba);
            }
          }
          
          add3DDoor(puertaInterior.puertaX, puertaInterior.puertaY, puertaInterior.puertaZ, p.tipo === 'izq' || p.tipo === 'der', false);

          // --- SÍMBOLO TÉCNICO DE PUERTA (ARCO) ---
          if (scene.userData.isTechnical) {
            const symbolColor = scene.userData.isBlueprint ? '#ffffff' : '#333333';
            const arcMat = new THREE.LineBasicMaterial({ color: symbolColor, transparent: true, opacity: 0.6 });
            const leafMat = new THREE.LineBasicMaterial({ color: symbolColor, transparent: true, opacity: 0.9 });
            
            const addDoorSymbol = (px: number, py: number, pz: number, angle: number) => {
              const group = new THREE.Group();
              const leafPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.9, 0, 0)];
              const leafGeo = new THREE.BufferGeometry().setFromPoints(leafPoints);
              const leafLine = new THREE.Line(leafGeo, leafMat);
              group.add(leafLine);
              const curve = new THREE.EllipseCurve(0, 0, 0.9, 0.9, 0, Math.PI/2, false, 0);
              const points = curve.getPoints(12).map(p => new THREE.Vector3(p.x, 0, p.y));
              const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
              const arcLine = new THREE.Line(arcGeo, arcMat);
              group.add(arcLine);
              group.position.set(px, py + 0.06, pz);
              group.rotation.y = angle;
              scene.add(group);
            };

            if (p.tipo === 'izq' || p.tipo === 'der') {
              addDoorSymbol(p.pos[0], y, puertaInterior.puertaZ, p.tipo === 'izq' ? 0 : Math.PI);
            } else {
              addDoorSymbol(puertaInterior.puertaX, y, p.pos[2], p.tipo === 'frente' ? Math.PI/2 : -Math.PI/2);
            }
          }

          // No dibujar la pared completa aquí (ya se dibujaron los segmentos)
          return;
        }
        // Si la pared es compartida pero este ambiente NO es el primario, omitirla
        let paredCompartida = false;
        for (const pi of puertasInteriores) {
          if (
            ((p.tipo === 'izq' && Math.abs(p.pos[0] - pi.pared.x) < TOL && Math.abs(p.pos[1] - pi.pared.y) < TOL && Math.abs(p.pos[2] - pi.pared.z) < TOL && Math.abs(p.size[2] - pi.pared.dz) < TOL) ||
             (p.tipo === 'der' && Math.abs(p.pos[0] - pi.pared.x) < TOL && Math.abs(p.pos[1] - pi.pared.y) < TOL && Math.abs(p.pos[2] - pi.pared.z) < TOL && Math.abs(p.size[2] - pi.pared.dz) < TOL) ||
             (p.tipo === 'fondo' && Math.abs(p.pos[2] - pi.pared.z) < TOL && Math.abs(p.pos[1] - pi.pared.y) < TOL && Math.abs(p.pos[0] - pi.pared.x) < TOL && Math.abs(p.size[0] - pi.pared.dx) < TOL) ||
             (p.tipo === 'frente' && Math.abs(p.pos[2] - pi.pared.z) < TOL && Math.abs(p.pos[1] - pi.pared.y) < TOL && Math.abs(p.pos[0] - pi.pared.x) < TOL && Math.abs(p.size[0] - pi.pared.dx) < TOL))
          ) {
            paredCompartida = true;
          }
        }
        if (paredCompartida) {
          // Omitir esta pared
          return;
        }
      if (!paredesSet.has(p.key)) {
        paredesSet.add(p.key);
        const geometry = new WorldBoxGeometry(dx, dy, dz, 1, 1, 1, [x, y, z]);
        const mesh = new THREE.Mesh(geometry, resolvedMaterial);
        mesh.position.set(
          x + (dx / 2),
          y + (dy / 2),
          z + (dz / 2)
        );
        scene.add(mesh);
      }
    });
  });
  });

  // --- DIBUJAR PISOS ENTRE PLANTAS ---
  // Para cada planta (excepto la última), dibujar una losa horizontal que cubra el área de los ambientes de esa planta
  const plantas = Object.keys(ambientesPorPlanta).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < plantas.length - 1; i++) {
    const ambientesPlanta = ambientesPorPlanta[plantas[i]] || [];
    const ambientesPlantaSup = ambientesPorPlanta[plantas[i + 1]] || [];
    if (ambientesPlanta.length === 0) continue;
    // Bounding box de la planta inferior
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity;
    ambientesPlanta.forEach(a => {
      const [x, y, z] = a.origen;
      const [dx, dy, dz] = a.dimensiones;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + dx);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z + dz);
      maxY = Math.max(maxY, y + dy);
    });
    // Dibuja la losa principal bajo la planta inferior
    const geometry = new WorldBoxGeometry(maxX - minX, 0.12, maxZ - minZ, 1, 1, 1, [minX, maxY, minZ]);
    const material = new THREE.MeshStandardMaterial({ color: '#e0d2b3', wireframe: wireframeMode, transparent: wireframeMode, opacity: wireframeMode ? 0.2 : 1 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(minX + (maxX - minX) / 2, maxY, minZ + (maxZ - minZ) / 2);
    scene.add(mesh);
    // Para cada ambiente de la planta superior, si sobresale, dibuja piso local
    ambientesPlantaSup.forEach(a => {
      const [x, y, z] = a.origen;
      const [dx, dy, dz] = a.dimensiones;
      // Si alguna esquina está fuera del bounding box de la planta inferior
      const esquinas = [
        [x, z],
        [x + dx, z],
        [x, z + dz],
        [x + dx, z + dz],
      ];
      const sobresale = esquinas.some(([ex, ez]) => ex < minX || ex > maxX || ez < minZ || ez > maxZ);
      if (sobresale) {
        const geometryAmb = new WorldBoxGeometry(dx, 0.12, dz);
        const meshAmb = new THREE.Mesh(geometryAmb, material.clone());
        meshAmb.position.set(x + dx / 2, maxY, z + dz / 2);
        scene.add(meshAmb);
      }
    });
  }
}

// Dibuja el techo solo en la planta superior
function addTecho(
  scene: THREE.Scene,
  ambientes: (AmbienteEditable & { planta: number })[],
  roofTexture: THREE.Texture | null,
  wireframeMode: boolean = false,
  roofType: "flat" | "gable" = "flat",
  wallMaterial: THREE.MeshStandardMaterial | null = null
) {
  if (ambientes.length === 0) return;
  if (scene.userData.isTechnical) return; // Hide roof in floorplan/blueprint
  // Encuentra el rectángulo mínimo que cubre todos los ambientes de la planta superior
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, maxY = -Infinity;
  ambientes.forEach((a: AmbienteEditable & { planta: number }) => {
    const [x, y, z] = a.origen;
    const [dx, dy, dz] = a.dimensiones;
    minX = Math.min(minX, x);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x + dx);
    maxZ = Math.max(maxZ, z + dz);
    maxY = Math.max(maxY, y + dy);
  });
  const overhang = 0.4;
  const thickness = 0.15;

  if (roofType === "flat") {
    // Techo plano mejorado (con alero y más grosor, como el del garage)
    const geometry = new WorldBoxGeometry(
      maxX - minX + overhang * 2, 
      thickness, 
      maxZ - minZ + overhang * 2, 
      1, 1, 1, 
      [minX - overhang, maxY, minZ - overhang]
    );
    const material = new THREE.MeshStandardMaterial({ 
      map: roofTexture, 
      color: '#444', 
      roughness: 0.8,
      wireframe: wireframeMode, 
      transparent: wireframeMode, 
      opacity: wireframeMode ? 0.3 : 1 
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(minX + (maxX - minX) / 2, maxY + thickness/2, minZ + (maxZ - minZ) / 2);
    scene.add(mesh);
  } else if (roofType === "gable") {
    // Techo a dos aguas mejorado (unido y sin huecos)
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const halfW = width / 2;
    const alturaTecho = Math.max(1.2, width * 0.25);
    const uvScale = 0.5;

    // 1. TÍMPANOS (Paredes triangulares en las líneas exactas de la casa)
    const createTimpano = (zPos: number) => {
      const gShape = new THREE.Shape();
      gShape.moveTo(0, 0);
      gShape.lineTo(width, 0);
      gShape.lineTo(halfW, alturaTecho);
      gShape.lineTo(0, 0);
      
      const gGeo = new THREE.ShapeGeometry(gShape);
      const pos = gGeo.attributes.position;
      const uvs = gGeo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const localX = pos.getX(i);
        const localY = pos.getY(i);
        // Usamos la posición real del vértice para asegurar una definición idéntica a la de las paredes
        uvs.setXY(i, (minX + localX) * uvScale, (maxY + localY) * uvScale);
      }
      
      const gMesh = new THREE.Mesh(gGeo, wallMaterial || new THREE.MeshStandardMaterial({ color: '#dddddd' }));
      gMesh.position.set(minX, maxY, zPos);
      scene.add(gMesh);
    };
    
    createTimpano(minZ);
    createTimpano(maxZ);

    // 2. AGUAS DEL TECHO (Estructura única en V para evitar huecos en la cumbrera)
    // Definimos el perfil del techo como una V invertida con grosor
    const rShape = new THREE.Shape();
    // Empezamos desde el alero izquierdo
    rShape.moveTo(-overhang, -0.05);
    rShape.lineTo(halfW, alturaTecho);
    rShape.lineTo(width + overhang, -0.05);
    // Bajamos para dar grosor
    rShape.lineTo(width + overhang, -0.05 - thickness);
    rShape.lineTo(halfW, alturaTecho - thickness);
    rShape.lineTo(-overhang, -0.05 - thickness);
    rShape.lineTo(-overhang, -0.05);

    const extrudeSettings = {
      steps: 1,
      depth: depth + overhang * 2,
      bevelEnabled: false
    };

    const roofGeo = new THREE.ExtrudeGeometry(rShape, extrudeSettings);
    const roofMat = new THREE.MeshStandardMaterial({ 
      map: roofTexture, 
      color: '#444', 
      roughness: 0.8,
      wireframe: wireframeMode, 
      transparent: wireframeMode, 
      opacity: wireframeMode ? 0.3 : 1,
      side: THREE.DoubleSide
    });

    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    // Posicionamos el bloque extruido. Como depth empieza en 0, restamos overhang en Z
    roofMesh.position.set(minX, maxY, minZ - overhang);
    scene.add(roofMesh);
  }
}

// Dibuja columnas de soporte para ambientes no apoyados
function addColumnasSoporte(
  scene: THREE.Scene,
  ambiente: AmbienteEditable & { planta: number },
  ambientes: (AmbienteEditable & { planta: number })[],
  color: string | number
) {
  if (ambiente.planta === 0) return; // No columnas para planta baja
  // Calcular bounds de la base
  const base = ambientes.filter(a => a.planta === 0);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  base.forEach(a => {
    minX = Math.min(minX, a.origen[0]);
    maxX = Math.max(maxX, a.origen[0] + a.dimensiones[0]);
    minZ = Math.min(minZ, a.origen[2]);
    maxZ = Math.max(maxZ, a.origen[2] + a.dimensiones[2]);
  });
  const [x, y, z] = ambiente.origen;
  const [dx, dy, dz] = ambiente.dimensiones;
  // Chequear si cada esquina está apoyada
  const esquinas = [
    [x, z],
    [x + dx, z],
    [x, z + dz],
    [x + dx, z + dz],
  ];
  esquinas.forEach(([ex, ez]) => {
    if (ex < minX || ex > maxX || ez < minZ || ez > maxZ) {
      // Dibuja columna desde el piso hasta la base del ambiente
      const geometry = new THREE.CylinderGeometry(0.08, 0.08, y, 16);
      // Color concreto claro, típico de renders arquitectónicos
      const material = new THREE.MeshStandardMaterial({ color: '#bca16a' });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(ex, y / 2, ez);
      scene.add(mesh);
    }
  });
}

// Dibuja una escalera de caracol realista entre planta baja y planta superior
function addEscaleraCaracol(
  scene: THREE.Scene | THREE.Group,
  baseY: number,
  altura: number,
  radio: number = 0.7,
  peldaños: number = 12,
  color: string | number = '#bca16a',
  wireframeMode: boolean = false
) {
  const stepHeight = altura / peldaños;
  const stepAngle = (2 * Math.PI) / peldaños;
  for (let i = 0; i < peldaños; i++) {
    const angle = i * stepAngle;
    const x = radio * Math.cos(angle);
    const z = radio * Math.sin(angle);
    const y = baseY + i * stepHeight;
    const geometry = new WorldBoxGeometry(0.3, 0.05, 0.7);
    const material = new THREE.MeshStandardMaterial({ color, wireframe: wireframeMode, transparent: wireframeMode, opacity: wireframeMode ? 0.3 : 1 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = -angle;
    scene.add(mesh);
  }
  // Opcional: eje central
  const ejeGeometry = new THREE.CylinderGeometry(0.08, 0.08, altura, 16);
  const ejeMaterial = new THREE.MeshStandardMaterial({ color: '#888' });
  const eje = new THREE.Mesh(ejeGeometry, ejeMaterial);
  eje.position.set(0, baseY + altura / 2, 0);
  scene.add(eje);
}

// Dibuja paneles solares sobre el techo de la planta superior, realistas y con cuadrícula
function addPanelesSolares(
  scene: THREE.Scene,
  ambientes: (AmbienteEditable & { planta: number })[],
  roofType: "flat" | "gable" = "flat"
) {
  if (ambientes.length === 0) return;
  if (scene.userData.isTechnical) return; // Hide solar panels in floorplan
  // Encuentra el rectángulo mínimo que cubre todos los ambientes de la planta superior
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, maxY = -Infinity;
  ambientes.forEach((a: AmbienteEditable & { planta: number }) => {
    const [x, y, z] = a.origen;
    const [dx, dy, dz] = a.dimensiones;
    minX = Math.min(minX, x);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x + dx);
    maxZ = Math.max(maxZ, z + dz);
    maxY = Math.max(maxY, y + dy);
  });
  // Paneles: 2 filas x 4 columnas por agua
  const filas = 2, cols = 4;
  const panelW = (maxX - minX) / (cols + 1);
  const panelH = (maxZ - minZ) / (filas + 2);
  const panelAngle = Math.PI / 9; // ~20°
  const soporteAltura = 0.12;
  // Helper para cuadrícula
  function addGrid(panelMesh: THREE.Mesh, w: number, h: number, rows: number, cols: number) {
    const gridGroup = new THREE.Group();
    // Líneas verticales
    for (let i = 1; i < cols; i++) {
      const geo = new WorldBoxGeometry(0.01, 0.01, h * 0.98);
      const mat = new THREE.MeshBasicMaterial({ color: 'white' });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-w/2 + (w * i) / cols, 0.021, 0);
      gridGroup.add(mesh);
    }
    // Líneas horizontales
    for (let j = 1; j < rows; j++) {
      const geo = new WorldBoxGeometry(w * 0.98, 0.01, 0.01);
      const mat = new THREE.MeshBasicMaterial({ color: 'white' });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0.021, -h/2 + (h * j) / rows);
      gridGroup.add(mesh);
    }
    panelMesh.add(gridGroup);
  }
  if (roofType === 'flat') {
    for (let i = 0; i < filas; i++) {
      for (let j = 0; j < cols; j++) {
        const px = minX + panelW * (j + 1);
        const pz = minZ + panelH * (i + 2);
        const py = maxY + soporteAltura;
        // Panel
        const geometry = new WorldBoxGeometry(panelW * 0.9, 0.02, panelH * 0.9);
        const material = new THREE.MeshStandardMaterial({ color: '#1e40af', emissive: '#3b82f6', metalness: 0.5, roughness: 0.3 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(px, py, pz);
        mesh.rotation.x = -panelAngle;
        scene.add(mesh);
        // Soporte
        const soporte = new THREE.CylinderGeometry(0.012, 0.012, soporteAltura, 8);
        const soporteMesh = new THREE.Mesh(soporte, new THREE.MeshStandardMaterial({ color: '#888' }));
        soporteMesh.position.set(px, maxY + soporteAltura/2, pz);
        scene.add(soporteMesh);
        // Cuadrícula
        addGrid(mesh, panelW * 0.9, panelH * 0.9, 6, 10);
      }
    }
  } else if (roofType === 'gable') {
    // Paneles en ambas aguas
    const alturaTecho = Math.max(1.2, (maxX - minX) * 0.25);
    const centro = minX + (maxX - minX) / 2;
    const pendiente = alturaTecho / ((maxX - minX) / 2);
    const anguloPendiente = Math.atan(pendiente);
    // Normales de cada agua
    const normalIzq = new THREE.Vector3(-pendiente, 1, 0).normalize();
    const normalDer = new THREE.Vector3(pendiente, 1, 0).normalize();
    // Lado izquierdo
    for (let i = 0; i < filas; i++) {
      for (let j = 0; j < cols; j++) {
        const rel = (j + 1) / (cols + 1);
        // Limita px para que no sobresalga
        const px = minX + rel * ((centro - minX) * 0.98);
        const pz = minZ + panelH * (i + 2);
        // Altura sobre la pendiente
        const dx = px - minX;
        const yBase = maxY + pendiente * dx;
        // Panel
        const geometry = new WorldBoxGeometry(panelW * 0.9, 0.02, panelH * 0.9);
        const material = new THREE.MeshStandardMaterial({ color: '#1e40af', emissive: '#3b82f6', metalness: 0.5, roughness: 0.3 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(px, yBase + soporteAltura, pz);
        // Orientar el panel según la normal de la pendiente
        const up = new THREE.Vector3(0, 1, 0);
        mesh.quaternion.setFromUnitVectors(up, normalIzq);
        scene.add(mesh);
        // Soporte
        const soporte = new THREE.CylinderGeometry(0.012, 0.012, soporteAltura, 8);
        const soporteMesh = new THREE.Mesh(soporte, new THREE.MeshStandardMaterial({ color: '#888' }));
        soporteMesh.position.set(px, yBase + soporteAltura/2, pz);
        scene.add(soporteMesh);
        // Cuadrícula
        addGrid(mesh, panelW * 0.9, panelH * 0.9, 6, 10);
      }
    }
    // Lado derecho
    for (let i = 0; i < filas; i++) {
      for (let j = 0; j < cols; j++) {
        const rel = (j + 1) / (cols + 1);
        // Limita px para que no sobresalga
        const px = centro + rel * ((maxX - centro) * 0.98);
        const pz = minZ + panelH * (i + 2);
        // Altura sobre la pendiente
        const dx = px - maxX;
        const yBase = maxY + pendiente * Math.abs(dx);
        // Panel
        const geometry = new WorldBoxGeometry(panelW * 0.9, 0.02, panelH * 0.9);
        const material = new THREE.MeshStandardMaterial({ color: '#1e40af', emissive: '#3b82f6', metalness: 0.5, roughness: 0.3 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(px, yBase + soporteAltura, pz);
        // Orientar el panel según la normal de la pendiente
        const up = new THREE.Vector3(0, 1, 0);
        mesh.quaternion.setFromUnitVectors(up, normalDer);
        scene.add(mesh);
        // Soporte
        const soporte = new THREE.CylinderGeometry(0.012, 0.012, soporteAltura, 8);
        const soporteMesh = new THREE.Mesh(soporte, new THREE.MeshStandardMaterial({ color: '#888' }));
        soporteMesh.position.set(px, yBase + soporteAltura/2, pz);
        scene.add(soporteMesh);
        // Cuadrícula
        addGrid(mesh, panelW * 0.9, panelH * 0.9, 6, 10);
      }
    }
  }
}

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

export default function CasaBuilder({ config, wireframe }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const wireframeMode = wireframe || false;
  const sceneRef = useRef<THREE.Scene | null>(null);

  const handleExport = () => {
    if (sceneRef.current) {
      const exporter = new GLTFExporter();
      exporter.parse(
        sceneRef.current,
        (result) => {
          if (result instanceof ArrayBuffer) {
            const blob = new Blob([result], { type: "application/octet-stream" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "casa.glb";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
          }
        },
        (error) => {
          console.error("Error al exportar a GLB:", error);
        },
        { binary: true }
      );
    }
  };

  const getCenter = () => {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    config.ambientes.forEach(a => {
      const [x, y, z] = a.origen;
      const [dx, dy, dz] = a.dimensiones;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x + dx);
      maxY = Math.max(maxY, y + dy);
      maxZ = Math.max(maxZ, z + dz);
    });
    return [
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    ];
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current; // Evitar referencia stale en el cleanup

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: !isMobile,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const isTechnical = config.viewMode === 'floorplan' || config.viewMode === 'blueprint';
    const isFloorPlan = config.viewMode === 'floorplan';
    const isBlueprint = config.viewMode === 'blueprint';
    const isSketch = config.viewMode === 'sketch';

    if (isBlueprint) {
      scene.background = new THREE.Color("#134f96"); // classic blueprint blue
    } else if (isFloorPlan) {
      scene.background = new THREE.Color("#4a7a4a"); // Green grass exterior
    } else if (isSketch) {
      scene.background = new THREE.Color("#ffffff");
    } else if (config.environment !== 'ninguno') {
      const textureLoader = new THREE.TextureLoader();
      const envTexture = textureLoader.load(
        config.environment === 'campo_sierras' ? '/env_sierras.png' :
        config.environment === 'montaña_mendoza' ? '/env_mendoza.png' :
        '/env_city.png'
      );
      envTexture.mapping = THREE.EquirectangularReflectionMapping;
      envTexture.colorSpace = THREE.SRGBColorSpace;
      scene.background = envTexture;
      scene.environment = envTexture;
      scene.backgroundRotation.x = 0;
      scene.environmentRotation.x = 0;
    } else {
      scene.background = new THREE.Color("#f0f0f0");
    }

    scene.userData.isTechnical = !!isTechnical;
    scene.userData.isBlueprint = !!isBlueprint;
    sceneRef.current = scene;

    // ==========================================
    // CAMERA & CONTROLS SETTINGS
    // ==========================================
    const aspect = width / height;
    let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    
    // Calcular posiciones pegadas según la disposición
    const ambientesConPos = getAmbientesPos(config.plantas, config);
    // Calcular centro para la cámara
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    ambientesConPos.forEach(a => {
      const [x, y, z] = a.origen;
      const [dx, dy, dz] = a.dimensiones;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x + dx);
      maxY = Math.max(maxY, y + dy);
      maxZ = Math.max(maxZ, z + dz);
    });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    // Extend bounds to include garage, pool, garden for frustum
    const garageCount = config.garages || 0;
    const garageW = garageCount * 4.4;
    const garageExtMaxX = garageCount > 0 ? maxX + garageW + 1 : maxX;
    const poolActive = config.pool?.active;
    const poolL = poolActive ? (config.pool!.length || 4) : 0;
    const poolExtMinZ = poolActive ? minZ - poolL - 2 : minZ;
    const gardenPad = (config.gardenStyle && config.gardenStyle !== 'ninguno') ? 4 : 0;
    const extMinX = minX - gardenPad - 2;
    const extMaxX = Math.max(garageExtMaxX, maxX) + gardenPad + 2;
    const extMinZ = Math.min(poolExtMinZ, minZ) - gardenPad - 2;
    const extMaxZ = maxZ + gardenPad + 2;
    const extCx = (extMinX + extMaxX) / 2;
    const extCz = (extMinZ + extMaxZ) / 2;

    if (isTechnical) {
      const spanX = (extMaxX - extMinX);
      const spanZ = (extMaxZ - extMinZ);
      const fAspect = width / height;
      // Fit frustum to the full extent including garden/garage/pool
      const frustumSize = Math.max(spanX / fAspect, spanZ) * 1.25;
      camera = new THREE.OrthographicCamera(
        frustumSize * fAspect / -2, frustumSize * fAspect / 2,
        frustumSize / 2, frustumSize / -2,
        0.1, 1000
      );
      // Position camera directly above center of full extent, looking straight down
      camera.position.set(extCx, 60, extCz);
      camera.up.set(0, 0, -1); // North = -Z direction
      camera.lookAt(extCx, 0, extCz);
      scene.userData.isTechnical = true;
      scene.userData.isBlueprint = isBlueprint;
    } else {
      camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
      // Auto-scale camera distance based on building footprint
      const buildingSpan = Math.max(maxX - minX, maxZ - minZ, maxY - minY);
      const distance = isMobile ? Math.max(22, buildingSpan * 2.2) : Math.max(18, buildingSpan * 2.0);
      camera.position.set(cx + distance * 0.6, cy + distance * 0.5, cz + distance);
      camera.lookAt(cx, cy, cz);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    if (isTechnical) {
      // Lock camera to perfectly top-down (no rotation allowed)
      controls.target.set(extCx, 0, extCz);
      controls.enableRotate = false;
      controls.screenSpacePanning = true;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = 0;
      controls.minAzimuthAngle = 0;
      controls.maxAzimuthAngle = 0;
    } else {
      controls.target.set(cx, cy, cz);
    }
    
    // Optimizar controles para móviles
    if (isMobile && !isTechnical) {
      controls.dampingFactor = 0.05;
      controls.rotateSpeed = 0.5;
      controls.panSpeed = 0.5;
      controls.zoomSpeed = 0.5;
      controls.maxDistance = 20;
      controls.minDistance = 3;
      controls.maxPolarAngle = Math.PI / 2;
      controls.minPolarAngle = 0;
    } else if (!isTechnical) {
      controls.dampingFactor = 0.05;
      controls.rotateSpeed = 1;
      controls.panSpeed = 1;
      controls.zoomSpeed = 1;
      controls.maxDistance = 80;
      controls.minDistance = 2;
    } else {
      controls.dampingFactor = 0.05;
      controls.panSpeed = 0.8;
      controls.zoomSpeed = 1.2;
    }

    
    controls.update();
    
    const minCameraY = 1; // Altura mínima de la cámara
    const animate = () => {
      controls.update();
      // Limita la altura mínima de la cámara
      if (camera.position.y < minCameraY) {
        camera.position.y = minCameraY;
      }
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);
    
    // Lighting: in floorplan mode use flat top-down light for clean plan look
    if (isTechnical) {
      const ambient = new THREE.AmbientLight(0xffffff, 1.8);
      scene.add(ambient);
      const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
      topLight.position.set(0, 50, 0); // straight down
      scene.add(topLight);
    } else {
      const ambient = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambient);
      const light = new THREE.DirectionalLight(0xffffff, 1.2);
      light.position.set(5, 10, 5);
      scene.add(light);
    }

    // 🏗️ GRID TÉCNICO PROFESIONAL (1m x 1m)
    if (isTechnical) {
      const gridSize = Math.max((extMaxX - extMinX), (extMaxZ - extMinZ)) + 20;
      const gridHelper = new THREE.GridHelper(Math.ceil(gridSize), Math.ceil(gridSize), 
        isBlueprint ? 0x2d6db4 : 0xcccccc,
        isBlueprint ? 0x225d9c : 0xdddddd
      );
      gridHelper.position.set(extCx, 0.02, extCz);
      if (isBlueprint) {
        (gridHelper.material as any).opacity = 0.5;
        (gridHelper.material as any).transparent = true;
      } else {
        (gridHelper.material as any).opacity = 0.5;
        (gridHelper.material as any).transparent = true;
      }
      scene.add(gridHelper);
    }

    // Carga las texturas globales al inicio del useEffect
    const textureLoader = new THREE.TextureLoader();
    const wallTextureObj = textureLoader.load('/' + config.wallTexture);
    wallTextureObj.wrapS = wallTextureObj.wrapT = THREE.RepeatWrapping;
    wallTextureObj.colorSpace = THREE.SRGBColorSpace;
    const floorTextureObj = textureLoader.load('/' + config.floorTexture);
    floorTextureObj.wrapS = floorTextureObj.wrapT = THREE.RepeatWrapping;
    floorTextureObj.colorSpace = THREE.SRGBColorSpace;
    const roofTextureObj = textureLoader.load('/' + config.roofTexture);
    roofTextureObj.wrapS = roofTextureObj.wrapT = THREE.RepeatWrapping;
    roofTextureObj.colorSpace = THREE.SRGBColorSpace;
    const garageDoorTexture = textureLoader.load('/puerta_garage.png');
    garageDoorTexture.colorSpace = THREE.SRGBColorSpace;

    // Materiales globales con lógica de temas (A la Prome AI)

    const getThemedMaterial = (map: THREE.Texture | null, defaultColor: string) => {
      if (isBlueprint) {
        return new THREE.MeshStandardMaterial({ 
          color: '#1a4e8a', 
          wireframe: false, 
          roughness: 0.7, 
          metalness: 0.1,
          opacity: 0.9,
          transparent: true
        });
      }
      if (isSketch) {
        return new THREE.MeshStandardMaterial({ 
          color: '#ffffff', 
          roughness: 1, 
          metalness: 0
        });
      }
      return new THREE.MeshStandardMaterial({ 
        map: map, 
        color: map ? '#ffffff' : defaultColor, 
        roughness: 0.8 
      });
    };

    const wallMaterial = getThemedMaterial(wallTextureObj, '#dddddd');
    wallMaterial.side = THREE.DoubleSide;
    const floorMaterial = getThemedMaterial(floorTextureObj, '#bbbbbb');
    const roofMaterial = getThemedMaterial(roofTextureObj, '#444');

    // ============================================================
    // PLANO ARQUITECTÓNICO PROFESIONAL — ETIQUETAS Y MOBILIARIO
    // ============================================================
    if (isTechnical) {
      const symbolColor = isBlueprint ? '#ffffff' : '#2a2a2a';
      const dimensionColor = isBlueprint ? '#ffffff' : '#1a1a1a';
      const lineMat = new THREE.LineBasicMaterial({ color: symbolColor, transparent: true, opacity: isBlueprint ? 1.0 : 0.85 });
      const dimMat = new THREE.LineBasicMaterial({ color: dimensionColor, transparent: true, opacity: isBlueprint ? 1.0 : 0.9 });

      // Blueprint hatch texture generator
      const createHatchTex = () => {
        const cvs = document.createElement('canvas');
        cvs.width = 16; cvs.height = 16;
        const ctx = cvs.getContext('2d')!;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-2, 18);
        ctx.lineTo(18, -2);
        ctx.stroke();
        const tex = new THREE.CanvasTexture(cvs);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
      };

      // ── Floor per room (wood color top-down) ──
      ambientesConPos.forEach(a => {
        const [rx, ry, rz] = a.origen;
        const [rdx, rdy, rdz] = a.dimensiones;
        const floorColors: Record<string, string> = {
          dormitorio: isBlueprint ? '#1a3d6e' : '#c8a876',
          living:     isBlueprint ? '#1a3d6e' : '#d4b482',
          comedor:    isBlueprint ? '#1a3d6e' : '#c9a86c',
          cocina:     isBlueprint ? '#1e3a5a' : '#b8b8b8',
          baño:       isBlueprint ? '#1e3a5a' : '#d0d0d0',
          oficina:    isBlueprint ? '#1a3d6e' : '#c4aa84',
          quincho:    isBlueprint ? '#1a3d6e' : '#bfa070',
        };
        const fc = floorColors[a.tipo || 'living'] || (isBlueprint ? '#1a3d6e' : '#c8a876');
        if (!isBlueprint) {
          const floorGeo = new THREE.PlaneGeometry(rdx, rdz);
          const floorMat2 = new THREE.MeshStandardMaterial({ color: fc, roughness: 0.8 });
          const floorMesh = new THREE.Mesh(floorGeo, floorMat2);
          floorMesh.rotation.x = -Math.PI / 2;
          floorMesh.position.set(rx + rdx / 2, ry + 0.03, rz + rdz / 2);
          scene.add(floorMesh);
        }

        // ── PLAN WALLS (Thick dark lines visible from top) ──
        const wallThickness = 0.22;
        
        const addWall = (w: number, d: number, px: number, py: number, pz: number) => {
          const geom = new THREE.PlaneGeometry(w, d);
          let mat: THREE.Material;
          if (isBlueprint) {
            const tex = createHatchTex();
            tex.repeat.set(Math.max(w * 3, 1), Math.max(d * 3, 1));
            mat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: tex, transparent: true });
          } else {
            mat = new THREE.MeshBasicMaterial({ color: '#333333' });
          }
          const mesh = new THREE.Mesh(geom, mat);
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(px, py, pz);
          mesh.userData = { isTechnical: true }; // Marcado para limpieza
          scene.add(mesh);
          
          if (isBlueprint) {
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
            edges.rotation.x = -Math.PI / 2;
            edges.position.set(px, py, pz);
            scene.add(edges);
          }
        };

        addWall(rdx, wallThickness, rx + rdx/2, ry + 0.08, rz); // top
        addWall(rdx, wallThickness, rx + rdx/2, ry + 0.08, rz + rdz); // bottom
        addWall(wallThickness, rdz, rx, ry + 0.08, rz + rdz/2); // left
        addWall(wallThickness, rdz, rx + rdx, ry + 0.08, rz + rdz/2); // right
      });

      // ── Room Labels (Sprite canvas textures) ──
      ambientesConPos.forEach(a => {
        const area = (a.dimensiones[0] * a.dimensiones[2]).toFixed(1);
        const canvas2 = document.createElement('canvas');
        canvas2.width = 512;
        canvas2.height = 256;
        const ctx2 = canvas2.getContext('2d')!;
        ctx2.clearRect(0, 0, 512, 256);
        ctx2.fillStyle = isBlueprint ? '#ffffff' : '#1a1a1a';
        ctx2.textAlign = 'center';
        
        if (isBlueprint) {
          ctx2.font = 'normal 48px "Trebuchet MS", Arial, sans-serif';
          const labels: Record<string, string> = {
            dormitorio: 'Bedroom', living: 'Living Area', comedor: 'Dining',
            cocina: 'Kitchen', baño: 'Bathroom', oficina: 'Office', quincho: 'Patio'
          };
          const text = labels[a.tipo || 'living'] || 'Room';
          ctx2.fillText(text, 256, 128);
        } else {
          ctx2.font = 'bold 52px Arial';
          ctx2.fillText((a.tipo || 'AMBIENTE').toUpperCase(), 256, 90);
          ctx2.font = '36px Arial';
          ctx2.fillText(`${area} m²`, 256, 148);
          ctx2.font = 'italic 28px Arial';
          ctx2.fillStyle = '#555555';
          ctx2.fillText(`${a.dimensiones[0].toFixed(2)}m × ${a.dimensiones[2].toFixed(2)}m`, 256, 200);
        }
        
        const tex2 = new THREE.CanvasTexture(canvas2);        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex2, transparent: true, depthTest: false, depthWrite: false }));
        spr.position.set(a.origen[0] + a.dimensiones[0] / 2, a.origen[1] + 2.0, a.origen[2] + a.dimensiones[2] / 2);
        const labelSize = Math.max(2.5, a.dimensiones[0] * 0.5);
        spr.scale.set(labelSize, labelSize * 0.5, 1);
        spr.renderOrder = 9999;
        scene.add(spr);
      });

      // ── Furniture Symbols per room type ──
      const addLine = (points: THREE.Vector3[]) => {
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        scene.add(new THREE.Line(geo, lineMat));
      };
      const addRect = (cx2: number, cz2: number, w2: number, d2: number, y2: number) => {
        const hw = w2 / 2, hd = d2 / 2;
        const pts = [
          new THREE.Vector3(cx2 - hw, y2, cz2 - hd),
          new THREE.Vector3(cx2 + hw, y2, cz2 - hd),
          new THREE.Vector3(cx2 + hw, y2, cz2 + hd),
          new THREE.Vector3(cx2 - hw, y2, cz2 + hd),
          new THREE.Vector3(cx2 - hw, y2, cz2 - hd),
        ];
        addLine(pts);
      };
      const addCircle2D = (cx2: number, cz2: number, r: number, y2: number, segs = 16) => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= segs; i++) {
          const a2 = (i / segs) * Math.PI * 2;
          pts.push(new THREE.Vector3(cx2 + Math.cos(a2) * r, y2, cz2 + Math.sin(a2) * r));
        }
        addLine(pts);
      };

      ambientesConPos.forEach(a => {
        const [ax, ay, az] = a.origen;
        const [adx, ady, adz] = a.dimensiones;
        const fy = ay + 0.06;
        const cx2 = ax + adx / 2;
        const cz2 = az + adz / 2;

        if (a.tipo === 'dormitorio') {
          // Cama doble (1.6m x 2.0m) centrada
          const bw = Math.min(adx * 0.7, 1.6), bd = Math.min(adz * 0.65, 2.0);
          addRect(cx2, cz2, bw, bd, fy);
          // Almohadas (2 rectángulos pequeños en la cabecera)
          addRect(cx2 - bw * 0.22, cz2 - bd * 0.36, bw * 0.38, bd * 0.12, fy);
          addRect(cx2 + bw * 0.22, cz2 - bd * 0.36, bw * 0.38, bd * 0.12, fy);
          // Cabecera
          addRect(cx2, cz2 - bd * 0.44, bw, bd * 0.06, fy);
          // Mesita de luz
          addRect(ax + adx - 0.3, az + 0.3, 0.45, 0.45, fy);
        } else if (a.tipo === 'living') {
          // Sofá de 3 cuerpos (2.2m x 0.9m)
          const sw = Math.min(adx * 0.65, 2.2);
          addRect(cx2, az + 0.5, sw, 0.85, fy);
          // Respaldo del sofá
          addRect(cx2, az + 0.18, sw, 0.2, fy);
          // Brazo izq
          addRect(cx2 - sw / 2 - 0.1, az + 0.5, 0.2, 0.85, fy);
          // Brazo der
          addRect(cx2 + sw / 2 + 0.1, az + 0.5, 0.2, 0.85, fy);
          // Mesa ratonera circular
          addCircle2D(cx2, az + 1.6, 0.5, fy);
        } else if (a.tipo === 'comedor') {
          // Mesa rectangular + sillas
          const tw = Math.min(adx * 0.55, 1.8), td = Math.min(adz * 0.45, 0.9);
          addRect(cx2, cz2, tw, td, fy);
          // Sillas laterales
          for (let s = -1; s <= 1; s += 2) {
            addRect(cx2 + s * (tw / 2 + 0.25), cz2, 0.4, 0.4, fy);
          }
          // Sillas fondo/frente
          addRect(cx2, cz2 - (td / 2 + 0.25), 0.4, 0.4, fy);
          addRect(cx2, cz2 + (td / 2 + 0.25), 0.4, 0.4, fy);
        } else if (a.tipo === 'cocina') {
          // Mesada en L
          addRect(ax + adx - 0.3, cz2, 0.6, adz - 0.3, fy); // mesada lateral
          addRect(cx2, az + 0.3, adx - 0.8, 0.6, fy); // mesada frontal
          // Pileta (círculo)
          addCircle2D(ax + 0.7, az + 0.35, 0.2, fy, 10);
          // Hornallas (4 circulos)
          [[0.4, 0.3], [0.4, 0.65], [0.8, 0.3], [0.8, 0.65]].forEach(([ox, oz]) => {
            addCircle2D(ax + adx - ox, az + oz, 0.12, fy, 8);
          });
        } else if (a.tipo === 'baño') {
          // Inodoro: tanque + taza
          const tyStart = az + 0.15;
          addRect(ax + 0.3, tyStart + 0.1, 0.35, 0.2, fy); // tanque
          // Taza ovalada (aprox con rect redondeado)
          addRect(ax + 0.3, tyStart + 0.45, 0.38, 0.5, fy);
          // Lavatorio circular
          addCircle2D(ax + adx - 0.35, az + 0.35, 0.28, fy, 14);
          // Cruz del desagüe
          addLine([new THREE.Vector3(ax + adx - 0.35, fy, az + 0.35 - 0.15), new THREE.Vector3(ax + adx - 0.35, fy, az + 0.35 + 0.15)]);
          addLine([new THREE.Vector3(ax + adx - 0.35 - 0.15, fy, az + 0.35), new THREE.Vector3(ax + adx - 0.35 + 0.15, fy, az + 0.35)]);
          // Ducha o bañera
          if (adx > 2.5 && adz > 2.5) {
            addRect(cx2 + 0.3, az + adz - 0.7, 1.5, 0.85, fy); // bañera
          } else {
            addRect(ax + adx - 0.5, az + adz - 0.6, 0.8, 0.8, fy); // ducha
          }
        } else if (a.tipo === 'oficina') {
          // Escritorio en L
          addRect(ax + adx - 0.4, cz2, 0.8, adz * 0.5, fy);
          addRect(cx2, az + 0.35, adx * 0.5, 0.7, fy);
          // Silla
          addCircle2D(ax + adx - 0.4, cz2 + 0.5, 0.3, fy, 10);
        }
      });

      // ── Dimension Annotations ──
      const margin = 1.8; // distance from building edge
      const tickH = 0.25;
      const totalW = maxX - minX;
      const totalD = maxZ - minZ;

      const addDimLine = (p1: THREE.Vector3, p2: THREE.Vector3, label: string, labelPos: THREE.Vector3) => {
        // Main dimension line
        addLine([p1, p2]);
        // Tick marks
        const dir = p2.clone().sub(p1).normalize();
        const perp = new THREE.Vector3(-dir.z, 0, dir.x);
        addLine([p1.clone().addScaledVector(perp, -tickH), p1.clone().addScaledVector(perp, tickH)]);
        addLine([p2.clone().addScaledVector(perp, -tickH), p2.clone().addScaledVector(perp, tickH)]);
        // Arrow tips (small lines at angle)
        const arrowLen = 0.25;
        const a1 = dir.clone().multiplyScalar(arrowLen).addScaledVector(perp, arrowLen * 0.5);
        const a2 = dir.clone().multiplyScalar(arrowLen).addScaledVector(perp, -arrowLen * 0.5);
        addLine([p1, p1.clone().add(a1)]);
        addLine([p1, p1.clone().add(a2)]);
        addLine([p2, p2.clone().sub(a1)]);
        addLine([p2, p2.clone().sub(a2)]);
        // Label Sprite
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256; labelCanvas.height = 64;
        const lctx = labelCanvas.getContext('2d')!;
        lctx.clearRect(0, 0, 256, 64);
        lctx.fillStyle = isBlueprint ? '#aaccff' : '#1a1a1a';
        lctx.font = 'bold 40px Arial';
        lctx.textAlign = 'center';
        lctx.fillText(label, 128, 48);
        const ltex = new THREE.CanvasTexture(labelCanvas);
        const lspr = new THREE.Sprite(new THREE.SpriteMaterial({ map: ltex, transparent: true, depthTest: false }));
        lspr.position.copy(labelPos);
        lspr.scale.set(2.0, 0.5, 1);
        lspr.renderOrder = 9999;
        scene.add(lspr);
      };

      const dimY = 0.15;

      // Bottom total dimension
      addDimLine(
        new THREE.Vector3(minX, dimY, minZ - margin),
        new THREE.Vector3(maxX, dimY, minZ - margin),
        `${totalW.toFixed(2)} m`,
        new THREE.Vector3(cx, dimY, minZ - margin - 0.7)
      );

      // Right total dimension
      addDimLine(
        new THREE.Vector3(maxX + margin, dimY, minZ),
        new THREE.Vector3(maxX + margin, dimY, maxZ),
        `${totalD.toFixed(2)} m`,
        new THREE.Vector3(maxX + margin + 1.2, dimY, cz)
      );

      // Per-room widths on top
      {
        const rooms0 = ambientesConPos.filter(a => a.planta === 0).sort((a, b) => a.origen[0] - b.origen[0]);
        rooms0.forEach(a => {
          const rx = a.origen[0], rw = a.dimensiones[0];
          addDimLine(
            new THREE.Vector3(rx, dimY, minZ - margin * 1.8),
            new THREE.Vector3(rx + rw, dimY, minZ - margin * 1.8),
            `${rw.toFixed(2)} m`,
            new THREE.Vector3(rx + rw / 2, dimY, minZ - margin * 1.8 - 0.7)
          );
        });
      }

      // Per-room depths on left side
      {
        const rooms0 = ambientesConPos.filter(a => a.planta === 0).sort((a, b) => a.origen[2] - b.origen[2]);
        const seen = new Set<string>();
        rooms0.forEach(a => {
          const rz = a.origen[2], rd = a.dimensiones[2];
          const key = `${rz.toFixed(2)}_${rd.toFixed(2)}`;
          if (!seen.has(key)) {
            seen.add(key);
            addDimLine(
              new THREE.Vector3(minX - margin, dimY, rz),
              new THREE.Vector3(minX - margin, dimY, rz + rd),
              `${rd.toFixed(2)} m`,
              new THREE.Vector3(minX - margin - 1.2, dimY, rz + rd / 2)
            );
          }
        });
      }

      // ── North Arrow ──
      const northX = extMaxX - 4;
      const northZ = extMinZ + 4;
      const northRadius = 0.8;
      addCircle2D(northX, northZ, northRadius, dimY);
      // Filled N-half triangle (arrow pointing north = -Z)
      addLine([
        new THREE.Vector3(northX, dimY, northZ - northRadius),
        new THREE.Vector3(northX - northRadius * 0.4, dimY, northZ + northRadius),
        new THREE.Vector3(northX, dimY, northZ + northRadius * 0.3),
        new THREE.Vector3(northX, dimY, northZ - northRadius),
      ]);
      addLine([
        new THREE.Vector3(northX, dimY, northZ - northRadius),
        new THREE.Vector3(northX + northRadius * 0.4, dimY, northZ + northRadius),
        new THREE.Vector3(northX, dimY, northZ + northRadius * 0.3),
      ]);
      // N label
      const nCanvas = document.createElement('canvas'); nCanvas.width = 64; nCanvas.height = 64;
      const nctx = nCanvas.getContext('2d')!;
      nctx.fillStyle = isBlueprint ? '#aaccff' : '#1a1a1a';
      nctx.font = 'bold 52px Arial'; nctx.textAlign = 'center';
      nctx.fillText('N', 32, 52);
      const ntex = new THREE.CanvasTexture(nCanvas);
      const nspr = new THREE.Sprite(new THREE.SpriteMaterial({ map: ntex, transparent: true, depthTest: false }));
      nspr.position.set(northX, dimY, northZ - northRadius - 0.7);
      nspr.scale.set(1, 1, 1);
      nspr.renderOrder = 9999;
      scene.add(nspr);

      // ── GARAGE & POOL & GARDEN PLAN DETAILS ──
      if (garageCount > 0) {
        const gx = maxX + 0.5, gz = minZ, gw = garageCount * 4.4, gd = 6;
        addRect(gx + gw/2, gz + gd/2, gw, gd, dimY);
        // Garage Label
        const gCanvas = document.createElement('canvas'); gCanvas.width = 256; gCanvas.height = 128;
        const gctx = gCanvas.getContext('2d')!;
        gctx.fillStyle = isBlueprint ? '#aaccff' : '#333333';
        gctx.font = 'bold 36px Arial'; gctx.textAlign = 'center';
        gctx.fillText('GARAGE', 128, 60);
        gctx.font = '24px Arial';
        gctx.fillText(`${gw.toFixed(1)}m × ${gd.toFixed(1)}m`, 128, 100);
        const gtex = new THREE.CanvasTexture(gCanvas);
        const gspr = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex, transparent: true }));
        gspr.position.set(gx + gw/2, dimY + 2.0, gz + gd/2);
        gspr.scale.set(3, 1.5, 1);
        gspr.renderOrder = 9999;
        scene.add(gspr);
        // Garage Dim
        addDimLine(new THREE.Vector3(gx, dimY, gz - 1), new THREE.Vector3(gx + gw, dimY, gz - 1), `${gw.toFixed(2)}m`, new THREE.Vector3(gx + gw/2, dimY, gz - 1.6));
      }

      if (poolActive) {
        const pw = config.pool!.width || 8, pl = config.pool!.length || 4;
        const px = (minX + maxX) / 2, pz = minZ - pl/2 - 1.5;
        // Pool Label
        const pCanvas = document.createElement('canvas'); pCanvas.width = 256; pCanvas.height = 128;
        const pctx = pCanvas.getContext('2d')!;
        pctx.fillStyle = isBlueprint ? '#aaccff' : '#006666';
        pctx.font = 'bold 36px Arial'; pctx.textAlign = 'center';
        pctx.fillText('PISCINA', 128, 60);
        pctx.font = '24px Arial';
        pctx.fillText(`${pw.toFixed(1)}m × ${pl.toFixed(1)}m`, 128, 100);
        const ptex = new THREE.CanvasTexture(pCanvas);
        const pspr = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptex, transparent: true, depthTest: false }));
        pspr.position.set(px, dimY + 2.0, pz);
        pspr.scale.set(3, 1.5, 1);
        pspr.renderOrder = 9999;
        scene.add(pspr);
        // Pool Dims
        addDimLine(new THREE.Vector3(px - pw/2, dimY, pz - pl/2 - 0.5), new THREE.Vector3(px + pw/2, dimY, pz - pl/2 - 0.5), `${pw.toFixed(2)}m`, new THREE.Vector3(px, dimY, pz - pl/2 - 1.1));
        addDimLine(new THREE.Vector3(px + pw/2 + 0.5, dimY, pz - pl/2), new THREE.Vector3(px + pw/2 + 0.5, dimY, pz + pl/2), `${pl.toFixed(2)}m`, new THREE.Vector3(px + pw/2 + 1.5, dimY, pz));
      }
    }

    // Paredes en gris claro por defecto
    addParedes(scene, ambientesConPos, wallMaterial, wireframeMode, config.doorStyle || 'moderna');

    // Objetos
    config.objetos?.forEach((o: Elemento) => {
      const geometry = new WorldBoxGeometry(...o.dimensiones);
      const material = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(config.objectColor).getHex(), 
        wireframe: wireframeMode, 
        transparent: wireframeMode, 
        opacity: wireframeMode ? 0.3 : 1 
      });
      const mesh = new THREE.Mesh(geometry, material);
      const [x, y, z] = o.origen;
      const [dx, dy, dz] = o.dimensiones;
      mesh.position.set(x + dx / 2, y + dy / 2, z + dz / 2);
      scene.add(mesh);
    });
    // Escalera (color fijo)
    config.escalera?.forEach((e: Elemento) => {
      const geometry = new WorldBoxGeometry(...e.dimensiones);
      const material = new THREE.MeshStandardMaterial({ 
        color: 0xff9900, 
        wireframe: wireframeMode, 
        transparent: wireframeMode, 
        opacity: wireframeMode ? 0.3 : 1 
      });
      const mesh = new THREE.Mesh(geometry, material);
      const [x, y, z] = e.origen;
      const [dx, dy, dz] = e.dimensiones;
      mesh.position.set(x + dx / 2, y + dy / 2, z + dz / 2);
      scene.add(mesh);
    });
    // Escalera de caracol automática si hay más de una planta
    if (config.plantas > 1) {
      const plantas = Array.from({ length: config.plantas - 1 }, (_, i) => i);
      plantas.forEach(pidx => {
        // Encuentra la altura y posición de la planta pidx
        const ambientesPlanta = ambientesConPos.filter(a => a.planta === pidx);
        let minY = Infinity, maxY = -Infinity;
        ambientesPlanta.forEach(a => {
          minY = Math.min(minY, a.origen[1]);
          maxY = Math.max(maxY, a.origen[1] + a.dimensiones[1]);
        });
        const altura = maxY - minY;
        // Ubica la escalera en la esquina frontal izquierda de la planta
        let minX = Infinity, minZ = Infinity;
        ambientesPlanta.forEach(a => {
          minX = Math.min(minX, a.origen[0]);
          minZ = Math.min(minZ, a.origen[2]);
        });
        const offsetX = minX + 1.0; // separa la escalera de la pared
        const offsetZ = minZ + 1.0;
        // Crea un grupo para trasladar la escalera
        const escaleraGroup = new THREE.Group();
        addEscaleraCaracol(escaleraGroup, minY, altura, 0.7, 12, '#bca16a', wireframeMode);
        escaleraGroup.position.set(offsetX, 0, offsetZ);
        scene.add(escaleraGroup);
      });
    }

    // Techo solo en la planta superior
    const plantaSuperior = Math.max(...config.ambientes.map(a => a.planta), 0);
    const ambientesSup = ambientesConPos.filter(a => a.planta === plantaSuperior);
    addTecho(
      scene,
      ambientesSup,
      isBlueprint || isSketch ? null : roofTextureObj,
      wireframeMode,
      config.roofType === 'gable' ? 'gable' : 'flat',
      wallMaterial as THREE.MeshStandardMaterial
    );

    // Paneles solares en el techo si está activado
    if (config.solarPanels) {
      addPanelesSolares(scene, ambientesSup, config.roofType === 'gable' ? 'gable' : 'flat');
    }

    // Ventanas en paredes exteriores
    addVentanas(scene, ambientesConPos, config.windowStyle || 'simple', ambientesConPos);

    // Cálculo del Lote Total
    const baseHouseW = maxX - minX;
    const baseHouseL = maxZ - minZ;
    const qD = 4.0;
    const pD = config.pool?.active ? (config.pool.length || 4) : 0;
    
    // El lote mínimo envuelve la casa, garage, quincho y pileta
    const totalGarageWidth = (config.garages || 0) * (4.2 + 0.2);
    const minLoteW = baseHouseW + totalGarageWidth + 2;
    
    let setbackBack = 2;
    if (config.quincho?.active) setbackBack += qD + 0.5;
    if (config.pool?.active) setbackBack += pD + 1.5;
    
    const minLoteL = baseHouseL + setbackBack + 4; // 4m de frente mínimo
    
    const loteW = Math.max(config.lote?.width || 20, minLoteW);
    const loteL = Math.max(config.lote?.length || 30, minLoteL);

    // Centrar la casa en el lote transversalmente (eje X)
    const houseCx = (minX + maxX) / 2;
    // Alineamos el borde derecho del garage si existe, o centramos
    const lotMinX = houseCx - loteW / 2;
    const lotMaxX = houseCx + loteW / 2;

    // Alinear la casa longitudinalmente (eje Z): el fondo dinámico según lo que haya atrás
    const lotMinZ = minZ - setbackBack;
    const lotMaxZ = lotMinZ + loteL;

    // Garages y autos
    if ((config.garages || 0) > 0) {
      addGarage(scene, config.garages!, minX, maxX, minZ, maxZ, lotMaxZ, wallMaterial as any, wireframeMode, garageDoorTexture);
    }

    // Piso del Lote (Asfalto Oscuro como base)
    const lotAsphaltMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 1 });
    const lotAsphalt = new THREE.Mesh(new WorldBoxGeometry(loteW, 0.02, loteL), lotAsphaltMat);
    lotAsphalt.position.set(houseCx, 0.01, (lotMinZ + lotMaxZ) / 2);
    scene.add(lotAsphalt);

    // Línea punteada perimetral del Lote
    const lotEdges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(loteW, loteL));
    const lotLineMat = new THREE.LineDashedMaterial({ color: 0xffaaaa, dashSize: 0.5, gapSize: 0.5, linewidth: 2 });
    const lotLine = new THREE.LineSegments(lotEdges, lotLineMat);
    lotLine.computeLineDistances();
    lotLine.rotation.x = -Math.PI / 2;
    lotLine.position.set(houseCx, 0.02, (lotMinZ + lotMaxZ) / 2);
    scene.add(lotLine);

    // Jardín
    if (config.gardenStyle && config.gardenStyle !== 'ninguno') {
      const gX = maxX; // Start of the first garage
      const gW = totalGarageWidth;
      addJardin(scene, config.gardenStyle, minX, maxX, minZ, maxZ, lotMinX, lotMaxX, lotMaxZ, gX, gW);
    }

    // Terraza en rooftop
    if (config.terrace && config.terrace !== 'ninguna') {
      addTerraza(scene, config.terrace, minX, maxX, maxY, minZ, maxZ);
    }

    // Scene Background color (fog/atmosphere)
    let envColor = '#1c1c1c'; 
    let groundColor = isFloorPlan ? '#4a7a4a' : (isBlueprint ? '#0a1628' : '#3f6630'); 
    
    if (isBlueprint) {
      scene.background = new THREE.Color("#0a1628");
      scene.fog = null;
    } else if (isFloorPlan) {
      scene.background = new THREE.Color("#4a7a4a");
      scene.fog = null;
    } else if (config.environment === 'ciudad_premium') {
      envColor = '#0a0a0a';
      groundColor = '#1f2022'; // asfalto oscuro
      
      const cityTexture = textureLoader.load('/env_city.png');
      cityTexture.mapping = THREE.EquirectangularReflectionMapping;
      cityTexture.colorSpace = THREE.SRGBColorSpace;
      scene.background = cityTexture;
      scene.environment = cityTexture;
      scene.fog = new THREE.Fog(envColor, 20, 100);
    } else if (config.environment === 'montaña_mendoza') {
      envColor = '#1f1b16';
      groundColor = '#4a4136'; // tierra montañosa
      scene.background = new THREE.Color(envColor);
      scene.fog = new THREE.Fog(envColor, 20, 100);
    } else if (config.environment === 'campo_sierras') {
      envColor = '#121412';
      groundColor = '#2b4221'; // verde sierra oscuro
      scene.background = new THREE.Color(envColor);
      scene.fog = new THREE.Fog(envColor, 20, 100);
    } else {
      scene.background = new THREE.Color(envColor);
      scene.fog = new THREE.Fog(envColor, 20, 100);
    }

    // Plano de piso general del entorno
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1 });
    const ground = new THREE.Mesh(groundGeometry, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0; 
    scene.add(ground);

    // Plano de concreto bajo la casa
    const concreteWidth = maxX - minX;
    const concreteDepth = maxZ - minZ;
    const concreteY = 0.011; 
    const concreteGeometry = new THREE.PlaneGeometry(concreteWidth, concreteDepth);
    const concrete = new THREE.Mesh(concreteGeometry, floorMaterial);
    concrete.rotation.x = -Math.PI / 2;
    if (!isTechnical) {
      concrete.position.set((minX + maxX) / 2, concreteY, (minZ + maxZ) / 2);
      scene.add(concrete);
    }

    // Pileta
    if (config.pool?.active) {
      const poolW = config.pool.width || 8;
      const poolD = config.pool.length || 4;
      // Patio trasero - Desplazado si hay quincho para evitar superposición
      const poolX = (minX + maxX) / 2;
      const quinchoOffset = config.quincho?.active ? 4.5 : 0;
      const poolZ = minZ - quinchoOffset - poolD / 2 - 1.5; 
      
      const poolGroup = new THREE.Group();
      
      // Agua translucida / iluminada
      const waterMaterial = new THREE.MeshStandardMaterial({ 
        color: '#00cccc', 
        transparent: true, 
        opacity: 0.85,
        emissive: '#004c4c',
        roughness: 0.1
      });
      const water = new THREE.Mesh(new WorldBoxGeometry(poolW, 0.1, poolD), waterMaterial);
      water.position.set(poolX, 0.06, poolZ);
      poolGroup.add(water);
      
      // Fondos de luz interna (para dar efecto profundidad premium)
      const poolLight = new THREE.PointLight( '#00ffff', 1.5, 10 );
      poolLight.position.set(poolX, 0.5, poolZ);
      poolGroup.add(poolLight);

      // Bordes calcáreos
      const borderMaterial = new THREE.MeshStandardMaterial({ color: '#cfcbc2', roughness: 0.9 });
      const bW = poolW + 1;
      const bD = poolD;
      
      const borderTop = new THREE.Mesh(new WorldBoxGeometry(bW, 0.12, 0.5), borderMaterial);
      borderTop.position.set(poolX, 0.06, poolZ - poolD/2 - 0.25);
      poolGroup.add(borderTop);
      
      const borderBot = new THREE.Mesh(new WorldBoxGeometry(bW, 0.12, 0.5), borderMaterial);
      borderBot.position.set(poolX, 0.06, poolZ + poolD/2 + 0.25);
      poolGroup.add(borderBot);
      
      const borderL = new THREE.Mesh(new WorldBoxGeometry(0.5, 0.12, bD), borderMaterial);
      borderL.position.set(poolX - poolW/2 - 0.25, 0.06, poolZ);
      poolGroup.add(borderL);
      
      const borderR = new THREE.Mesh(new WorldBoxGeometry(0.5, 0.12, bD), borderMaterial);
      borderR.position.set(poolX + poolW/2 + 0.25, 0.06, poolZ);
      poolGroup.add(borderR);
      
      scene.add(poolGroup);

      // Agregar decoración (reposeras y sombrilla)
      addDecoracionPileta(scene, poolX, poolZ, poolW, poolD);
    }

    // Quincho
    if (config.quincho?.active) {
      addQuincho(scene, minX, maxX, minZ, maxZ, config.garages || 0, wireframeMode);
    }

    // Note: furniture symbols and north arrow are now handled in the isTechnical block above.


    // Renderizar la escena
    renderer.render(scene, camera);

    // Manejador para redimensionar el canvas
    const handleResize = () => {
      if (!mount) return;
      const newWidth = mount.clientWidth;
      const newHeight = mount.clientHeight;

      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
      } else if (camera instanceof THREE.OrthographicCamera) {
        // Para cámara ortográfica recalculamos el frustum
        const fAspect = newWidth / newHeight;
        const spanX = (extMaxX - extMinX);
        const spanZ = (extMaxZ - extMinZ);
        const newFrustum = Math.max(spanX / fAspect, spanZ) * 1.25;
        camera.left   = newFrustum * fAspect / -2;
        camera.right  = newFrustum * fAspect / 2;
        camera.top    = newFrustum / 2;
        camera.bottom = newFrustum / -2;
        camera.updateProjectionMatrix();
      }

      renderer.setSize(newWidth, newHeight);
      renderer.render(scene, camera);
    };
    window.addEventListener('resize', handleResize);

    // Función de limpieza
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      if (mount) {
        mount.innerHTML = '';
      }
    };
  }, [config, wireframeMode, isMobile]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Indicador de controles para móviles */}
      {isMobile && (
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: '11px',
          pointerEvents: 'none',
          zIndex: 5,
          textAlign: 'center'
        }}>
          💡 Pellizca para Zoom • 1 dedo para Rotar • 2 dedos para Panear
        </div>
      )}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
} 