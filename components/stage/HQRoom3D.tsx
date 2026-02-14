'use client';

import { Suspense, useState, useRef, useEffect, useCallback, Component, type ReactNode } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import AgentModel, { INTERNAL_STATE_CODES } from './AgentModel';

// Error boundary for 3D rendering failures (mobile WebGL, model loading, etc.)
class Room3DErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-[360px] sm:h-[520px] flex items-center justify-center bg-hacker-terminal border border-hacker-border rounded-lg">
          <div className="text-center font-mono px-4">
            <div className="text-hacker-amber text-sm mb-2">// erreur_rendu_3d</div>
            <div className="text-hacker-muted text-xs mb-3">Le moteur 3D n&apos;a pas pu charger sur cet appareil.</div>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="text-hacker-green text-xs border border-hacker-green/30 px-3 py-1.5 rounded hover:bg-hacker-green/10 transition-colors"
            >
              $ retry --force
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ═══ CAMERA DEFAULTS ═══
const DEFAULT_CAM_POS: [number, number, number] = [16, 22, 16];
const DEFAULT_CAM_FOV = 36;
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 0, 0);

// ═══ ROOM LAYOUT ═══
// Real open-space office:
//   Left: workspace with 3 desk islands (face-to-face pairs)
//   Right: glass-walled conference room
//   Decorations: plants, whiteboard, coffee station, bookshelf

const WALL_HEIGHT = 3.0;
const WALL_COLOR = '#0d0d0d';
const WALL_EMISSIVE = '#00ff41';
const FLOOR_SIZE = { w: 26, d: 18 };

// ═══ DESK ISLANDS ═══
// Each island = 2 agents face-to-face across a shared desk surface
// Island center positions:
const ISLAND_CENTERS: [number, number, number][] = [
  [-6.5, 0, -5],   // Island 1 (top)
  [-6.5, 0,  0],   // Island 2 (middle)
  [-6.5, 0,  5],   // Island 3 (bottom)
];

// Agent desk positions (where they sit/stand)
// Left agent faces right (+x), right agent faces left (-x)
const deskPositions: [number, number, number][] = [
  [-8.5, 0, -5],   // CEO — island 1 left
  [-4.5, 0, -5],   // KIRA — island 1 right
  [-8.5, 0,  0],   // MADARA — island 2 left
  [-4.5, 0,  0],   // STARK — island 2 right
  [-8.5, 0,  5],   // L — island 3 left
  [-4.5, 0,  5],   // USOPP — island 3 right
];

// Agent rotations (face each other across desk)
const deskRotations: [number, number, number][] = [
  [0, 90, 0],    // CEO faces right
  [0, -90, 0],   // KIRA faces left
  [0, 90, 0],    // MADARA faces right
  [0, -90, 0],   // STARK faces left
  [0, 90, 0],    // L faces right
  [0, -90, 0],   // USOPP faces left
];

// ═══ MEETING ROOM ═══
// Glass-walled conference room on the right side
const MEETING_TABLE_POS: [number, number, number] = [7, 0, 0];
const MEETING_TABLE_SIZE = { w: 3.0, d: 1.4 }; // rectangular

// Meeting seats around rectangular table
const meetingSeatPositions: [number, number, number][] = [
  [5.2, 0, -0.9],   // seat 0 — left near
  [5.2, 0,  0.9],   // seat 1 — left far
  [7.0, 0, -1.5],   // seat 2 — end near
  [8.8, 0, -0.9],   // seat 3 — right near
  [8.8, 0,  0.9],   // seat 4 — right far
  [7.0, 0,  1.5],   // seat 5 — end far
];

// ═══ GLASS PARTITION ═══
const PARTITION_X = 1.5;
const DOOR_Z_MIN = -3.5;
const DOOR_Z_MAX = 3.5;

// ═══ COLLISION DATA ═══
const AGENT_RADIUS = 0.4;
const MIN_AGENT_DIST = AGENT_RADIUS * 2;

const ROOM_BOUNDS = {
  minX: -FLOOR_SIZE.w / 2 + AGENT_RADIUS,
  maxX:  FLOOR_SIZE.w / 2 - AGENT_RADIUS,
  minZ: -FLOOR_SIZE.d / 2 + AGENT_RADIUS,
  maxZ:  FLOOR_SIZE.d / 2 - AGENT_RADIUS,
};

const DIVIDER = { x: PARTITION_X, doorZMin: DOOR_Z_MIN, doorZMax: DOOR_Z_MAX };

const MEETING_TABLE_COLLISION = { x: MEETING_TABLE_POS[0], z: MEETING_TABLE_POS[2], radius: 1.8 };

// Obstacle AABBs — ALL furniture padded by agent radius
// Agents will steer around these via the velocity avoidance system
const OBSTACLE_BOXES: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [
  // ── Desk islands (3.2 × 1.2 each) ──
  ...ISLAND_CENTERS.map(pos => ({
    minX: pos[0] - 1.8 - AGENT_RADIUS,
    maxX: pos[0] + 1.8 + AGENT_RADIUS,
    minZ: pos[2] - 0.7 - AGENT_RADIUS,
    maxZ: pos[2] + 0.7 + AGENT_RADIUS,
  })),
  // ── Coffee station at [-2, 0, 7] — 1.3 × 0.7 ──
  { minX: -2.65 - AGENT_RADIUS, maxX: -1.35 + AGENT_RADIUS, minZ: 6.65 - AGENT_RADIUS, maxZ: 7.35 + AGENT_RADIUS },
  // ── Water cooler at [-3, 0, 7.5] — 0.35 × 0.35 ──
  { minX: -3.2 - AGENT_RADIUS, maxX: -2.8 + AGENT_RADIUS, minZ: 7.3 - AGENT_RADIUS, maxZ: 7.7 + AGENT_RADIUS },
  // ── Sofa at [10.5, 0, 6.5] rotated -90° — 0.6 × 1.4 ──
  { minX: 10.5 - 0.8 - AGENT_RADIUS, maxX: 10.5 + 0.8 + AGENT_RADIUS, minZ: 6.5 - 0.4 - AGENT_RADIUS, maxZ: 6.5 + 0.4 + AGENT_RADIUS },
  // ── Sofa at [10.5, 0, -6.5] rotated -90° — 0.6 × 1.4 ──
  { minX: 10.5 - 0.8 - AGENT_RADIUS, maxX: 10.5 + 0.8 + AGENT_RADIUS, minZ: -6.5 - 0.4 - AGENT_RADIUS, maxZ: -6.5 + 0.4 + AGENT_RADIUS },
  // ── Server rack at [0.5, 0, 7] rotated — 0.4 × 0.6 ──
  { minX: 0.5 - 0.4 - AGENT_RADIUS, maxX: 0.5 + 0.4 + AGENT_RADIUS, minZ: 7 - 0.4 - AGENT_RADIUS, maxZ: 7 + 0.4 + AGENT_RADIUS },
  // ── Bookshelves on left wall (against wall, 1.5 wide × 0.35 deep) ──
  { minX: -13 - AGENT_RADIUS, maxX: -12.45 + AGENT_RADIUS, minZ: -5.75 - AGENT_RADIUS, maxZ: -4.25 + AGENT_RADIUS },
  { minX: -13 - AGENT_RADIUS, maxX: -12.45 + AGENT_RADIUS, minZ: -0.75 - AGENT_RADIUS, maxZ:  0.75 + AGENT_RADIUS },
  { minX: -13 - AGENT_RADIUS, maxX: -12.45 + AGENT_RADIUS, minZ:  4.25 - AGENT_RADIUS, maxZ:  5.75 + AGENT_RADIUS },
];

export interface CollisionData {
  roomBounds: typeof ROOM_BOUNDS;
  obstacles: typeof OBSTACLE_BOXES;
  meetingTable: typeof MEETING_TABLE_COLLISION;
  divider: typeof DIVIDER;
  agentRadius: number;
  minAgentDist: number;
}

const COLLISION_DATA: CollisionData = {
  roomBounds: ROOM_BOUNDS,
  obstacles: OBSTACLE_BOXES,
  meetingTable: MEETING_TABLE_COLLISION,
  divider: DIVIDER,
  agentRadius: AGENT_RADIUS,
  minAgentDist: MIN_AGENT_DIST,
};

// Shared agent positions array: 6 agents × 2 (x, z)
const SHARED_POSITIONS = new Float32Array(12);

// Shared internal states: 1 per agent (encoded via INTERNAL_STATE_CODES)
const SHARED_INTERNAL_STATES = new Float32Array(6);

// Roam waypoints — spread across both rooms with clear corridors
const ROAM_WAYPOINTS: [number, number, number][] = [
  // ── Workspace corridors ──
  [-11, 0, -7.5],   // far top-left
  [-11, 0,  7.5],   // far bottom-left
  [-2,  0, -7.5],   // near top-left
  [-4.5, 0,  7.5],  // near bottom-left (avoids coffee station)
  [-6.5, 0, -2.5],  // between island 1 & 2
  [-6.5, 0,  2.5],  // between island 2 & 3
  [-2,  0, -5],     // corridor right of desks top
  [-2,  0,  0],     // corridor right of desks middle
  [-2,  0,  5],     // corridor right of desks bottom
  [-11, 0, -2.5],   // left wall corridor
  [-11, 0,  2.5],   // left wall corridor
  [-6.5, 0, -7.5],  // behind island 1
  [-6.5, 0,  7.5],  // behind island 3
  // ── Doorway approaches (NOT inside the passage) ──
  [-0.5, 0,  0],    // workspace side of door
  [3.5, 0,  0],     // conference side of door
  // ── Conference room ──
  [3.5, 0, -6],     // conference top-left
  [3.5, 0,  6],     // conference bottom-left
  [8.5, 0, -6],     // conference top-right (avoids sofa)
  [8.5, 0,  6],     // conference bottom-right (avoids sofa)
  [4,   0, -3],     // near table left-top
  [10,  0, -3],     // far right top
  [4,   0,  3],     // near table left-bottom
  [10,  0,  3],     // far right bottom
  [11,  0,  0],     // far right center
  [7,   0, -6],     // conference back
  [7,   0,  6],     // conference front
];

// Agent configs
const agentConfigs = [
  {
    id: 'opus',
    name: 'CEO',
    role: 'CEO // Chef des Opérations',
    model: '/models/minion.glb',
    hasModel: true,
    deskIndex: 0,
    position: deskPositions[0],
    rotation: deskRotations[0],
    status: 'working' as AgentStatus,
    color: '#f59e0b',
    thought: 'Review des propositions...',
  },
  {
    id: 'brain',
    name: 'KIRA',
    role: 'KIRA // Chef de Recherche',
    model: '/models/sage.glb',
    hasModel: true,
    deskIndex: 1,
    position: deskPositions[1],
    rotation: deskRotations[1],
    status: 'working' as AgentStatus,
    color: '#8b5cf6',
    thought: 'Validation des findings',
  },
  {
    id: 'growth',
    name: 'MADARA',
    role: 'MADARA // Spécialiste Croissance',
    model: '/models/scout.glb',
    hasModel: true,
    deskIndex: 2,
    position: deskPositions[2],
    rotation: deskRotations[2],
    status: 'idle' as AgentStatus,
    color: '#22c55e',
    thought: 'En attente ; prochain: Standup',
  },
  {
    id: 'creator',
    name: 'STARK',
    role: 'STARK // Directeur Créatif',
    model: '/models/quill.glb',
    hasModel: true,
    deskIndex: 3,
    position: deskPositions[3],
    rotation: deskRotations[3],
    status: 'idle' as AgentStatus,
    color: '#ec4899',
    thought: 'Brainstorm headlines',
  },
  {
    id: 'twitter-alt',
    name: 'L',
    role: 'L // Directeur Réseaux Sociaux',
    model: '/models/xalt.glb',
    hasModel: true,
    deskIndex: 4,
    position: deskPositions[4],
    rotation: deskRotations[4],
    status: 'idle' as AgentStatus,
    color: '#3b82f6',
    thought: 'Review coordination auto',
  },
  {
    id: 'company-observer',
    name: 'USOPP',
    role: 'USOPP // Auditeur Opérations',
    model: '/models/observer.glb',
    hasModel: true,
    deskIndex: 5,
    position: deskPositions[5],
    rotation: deskRotations[5],
    status: 'idle' as AgentStatus,
    color: '#ef4444',
    thought: 'Surveillance active',
  },
];

// ═══ ROOM COMPONENTS ═══

// Outer wall segment
function Wall({ start, end, height = WALL_HEIGHT }: { start: [number, number]; end: [number, number]; height?: number }) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const cx = (start[0] + end[0]) / 2;
  const cz = (start[1] + end[1]) / 2;

  return (
    <mesh position={[cx, height / 2, cz]} rotation={[0, angle, 0]}>
      <boxGeometry args={[0.1, height, length]} />
      <meshStandardMaterial
        color={WALL_COLOR}
        emissive={WALL_EMISSIVE}
        emissiveIntensity={0.015}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// Neon accent strip on top of walls
function NeonStrip({ start, end }: { start: [number, number]; end: [number, number] }) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const cx = (start[0] + end[0]) / 2;
  const cz = (start[1] + end[1]) / 2;

  return (
    <group>
      <mesh position={[cx, WALL_HEIGHT + 0.02, cz]} rotation={[0, angle, 0]}>
        <boxGeometry args={[0.12, 0.04, length]} />
        <meshBasicMaterial color={WALL_EMISSIVE} transparent opacity={0.5} />
      </mesh>
      <pointLight position={[cx, WALL_HEIGHT + 0.1, cz]} color={WALL_EMISSIVE} intensity={0.2} distance={3} />
    </group>
  );
}

// Room outer walls
function RoomWalls() {
  const hw = FLOOR_SIZE.w / 2;
  const hd = FLOOR_SIZE.d / 2;

  const outerWalls: [number, number][][] = [
    [[-hw, -hd], [hw, -hd]],   // front
    [[hw, -hd], [hw, hd]],      // right
    [[hw, hd], [-hw, hd]],      // back
    [[-hw, hd], [-hw, -hd]],    // left
  ];

  return (
    <group>
      {outerWalls.map((wall, i) => (
        <group key={`outer-${i}`}>
          <Wall start={wall[0]} end={wall[1]} />
          <NeonStrip start={wall[0]} end={wall[1]} />
        </group>
      ))}
    </group>
  );
}

// ═══ GLASS PARTITION ═══
// Separates workspace from conference room — transparent with frame
function GlassPartition() {
  const hd = FLOOR_SIZE.d / 2;
  const glassH = WALL_HEIGHT - 0.3; // slightly shorter than walls
  const frameColor = '#1a1a1a';

  // Top segment (above door)
  const topLen = hd - Math.abs(DOOR_Z_MIN);
  const topCz = (-hd + DOOR_Z_MIN) / 2;
  // Bottom segment (below door)
  const botLen = hd - DOOR_Z_MAX;
  const botCz = (hd + DOOR_Z_MAX) / 2;

  return (
    <group>
      {/* Top glass panel */}
      <mesh position={[PARTITION_X, glassH / 2, topCz]}>
        <boxGeometry args={[0.06, glassH, topLen]} />
        <meshPhysicalMaterial
          color="#0a1a0a"
          transparent
          opacity={0.2}
          roughness={0.1}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Top frame */}
      <mesh position={[PARTITION_X, glassH, topCz]}>
        <boxGeometry args={[0.08, 0.05, topLen]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>

      {/* Bottom glass panel */}
      <mesh position={[PARTITION_X, glassH / 2, botCz]}>
        <boxGeometry args={[0.06, glassH, botLen]} />
        <meshPhysicalMaterial
          color="#0a1a0a"
          transparent
          opacity={0.2}
          roughness={0.1}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Bottom frame */}
      <mesh position={[PARTITION_X, glassH, botCz]}>
        <boxGeometry args={[0.08, 0.05, botLen]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>

      {/* Door frame posts */}
      {[DOOR_Z_MIN, DOOR_Z_MAX].map((z, i) => (
        <mesh key={`doorpost-${i}`} position={[PARTITION_X, glassH / 2, z]}>
          <boxGeometry args={[0.1, glassH, 0.08]} />
          <meshStandardMaterial color={frameColor} emissive={WALL_EMISSIVE} emissiveIntensity={0.05} />
        </mesh>
      ))}

      {/* Door header beam */}
      <mesh position={[PARTITION_X, glassH, 0]}>
        <boxGeometry args={[0.1, 0.06, DOOR_Z_MAX - DOOR_Z_MIN]} />
        <meshStandardMaterial color={frameColor} emissive={WALL_EMISSIVE} emissiveIntensity={0.03} />
      </mesh>

      {/* Green neon strip along partition top */}
      <mesh position={[PARTITION_X, glassH + 0.04, 0]}>
        <boxGeometry args={[0.04, 0.02, FLOOR_SIZE.d]} />
        <meshBasicMaterial color={WALL_EMISSIVE} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

// ═══ DESK ISLAND ═══
// Shared double desk with center divider, 2 monitors, cable tray
function DeskIsland({ position, colorLeft, colorRight }: {
  position: [number, number, number];
  colorLeft: string;
  colorRight: string;
}) {
  const deskW = 3.2;  // total width (x)
  const deskD = 1.2;  // depth (z)
  const deskH = 0.72; // standard desk height
  const legInset = 0.15;

  return (
    <group position={position}>
      {/* ── Desktop surface ── */}
      <mesh position={[0, deskH, 0]}>
        <boxGeometry args={[deskW, 0.04, deskD]} />
        <meshStandardMaterial color="#111111" roughness={0.6} metalness={0.2} />
      </mesh>

      {/* ── Center divider screen ── */}
      <mesh position={[0, deskH + 0.2, 0]}>
        <boxGeometry args={[0.03, 0.38, deskD * 0.85]} />
        <meshStandardMaterial color="#1a1a1a" emissive="#003300" emissiveIntensity={0.05} />
      </mesh>

      {/* ── Legs (4 corner + 2 center support) ── */}
      {[
        [-deskW / 2 + legInset, deskH / 2, -deskD / 2 + legInset],
        [-deskW / 2 + legInset, deskH / 2,  deskD / 2 - legInset],
        [ deskW / 2 - legInset, deskH / 2, -deskD / 2 + legInset],
        [ deskW / 2 - legInset, deskH / 2,  deskD / 2 - legInset],
      ].map((pos, i) => (
        <mesh key={`leg-${i}`} position={pos as [number, number, number]}>
          <boxGeometry args={[0.04, deskH, 0.04]} />
          <meshStandardMaterial color="#222" metalness={0.5} />
        </mesh>
      ))}

      {/* ── Side panels (modesty panels) ── */}
      {[-1, 1].map((side, i) => (
        <mesh key={`panel-${i}`} position={[side * (deskW / 2 - 0.02), deskH / 2 + 0.05, 0]}>
          <boxGeometry args={[0.03, deskH * 0.6, deskD * 0.9]} />
          <meshStandardMaterial color="#0f0f0f" />
        </mesh>
      ))}

      {/* ── Cable tray underneath ── */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[deskW * 0.6, 0.03, 0.15]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* ── Left monitor (facing right) ── */}
      <group position={[-0.4, deskH + 0.04, 0]}>
        {/* Stand */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.02, 0.04, 0.24, 8]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} />
        </mesh>
        {/* Screen */}
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[0.03, 0.35, 0.55]} />
          <meshStandardMaterial color="#050505" emissive={colorLeft} emissiveIntensity={0.15} />
        </mesh>
        <pointLight color={colorLeft} intensity={0.15} distance={1.5} position={[-0.2, 0.35, 0]} />
      </group>

      {/* ── Right monitor (facing left) ── */}
      <group position={[0.4, deskH + 0.04, 0]}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.02, 0.04, 0.24, 8]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[0.03, 0.35, 0.55]} />
          <meshStandardMaterial color="#050505" emissive={colorRight} emissiveIntensity={0.15} />
        </mesh>
        <pointLight color={colorRight} intensity={0.15} distance={1.5} position={[0.2, 0.35, 0]} />
      </group>

      {/* ── Keyboard hints (subtle) ── */}
      {[-0.8, 0.8].map((x, i) => (
        <mesh key={`kb-${i}`} position={[x, deskH + 0.025, 0]}>
          <boxGeometry args={[0.35, 0.01, 0.15]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
      ))}
    </group>
  );
}

// ═══ OFFICE CHAIR ═══
function Chair({ position, color, faceRight }: {
  position: [number, number, number];
  color: string;
  faceRight?: boolean;
}) {
  const dir = faceRight ? 1 : -1;
  return (
    <group position={position}>
      {/* Base star */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.03, 5]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} />
      </mesh>
      {/* Piston */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
        <meshStandardMaterial color="#222" metalness={0.5} />
      </mesh>
      {/* Seat */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.4, 0.05, 0.4]} />
        <meshStandardMaterial color="#0a0a0a" emissive={color} emissiveIntensity={0.03} />
      </mesh>
      {/* Backrest */}
      <mesh position={[-dir * 0.18, 0.55, 0]}>
        <boxGeometry args={[0.05, 0.35, 0.35]} />
        <meshStandardMaterial color="#0a0a0a" emissive={color} emissiveIntensity={0.02} />
      </mesh>
    </group>
  );
}

// ═══ CONFERENCE TABLE ═══
// Rectangular table with rounded edges and power hub
function ConferenceTable({ position }: { position: [number, number, number] }) {
  const tw = MEETING_TABLE_SIZE.w;
  const td = MEETING_TABLE_SIZE.d;

  return (
    <group position={position}>
      {/* Table top */}
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[tw, 0.05, td]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.3} metalness={0.3} emissive="#003300" emissiveIntensity={0.02} />
      </mesh>
      {/* Table legs (4 corners) */}
      {[
        [-tw / 2 + 0.2, 0.36, -td / 2 + 0.15],
        [-tw / 2 + 0.2, 0.36,  td / 2 - 0.15],
        [ tw / 2 - 0.2, 0.36, -td / 2 + 0.15],
        [ tw / 2 - 0.2, 0.36,  td / 2 - 0.15],
      ].map((pos, i) => (
        <mesh key={`tleg-${i}`} position={pos as [number, number, number]}>
          <boxGeometry args={[0.06, 0.72, 0.06]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.5} />
        </mesh>
      ))}
      {/* Center power/data hub */}
      <mesh position={[0, 0.76, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.04, 16]} />
        <meshStandardMaterial color="#111" emissive="#00ff41" emissiveIntensity={0.1} />
      </mesh>
      {/* Hologram glow */}
      <pointLight position={[0, 1.0, 0]} color="#00ff41" intensity={0.3} distance={3} />
      {/* Neon outline on floor */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.0, 2.1, 32]} />
        <meshBasicMaterial color="#00ff41" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ═══ DECORATIVE ELEMENTS ═══

// Office plant — pot with foliage
function Plant({ position, size = 1 }: { position: [number, number, number]; size?: number }) {
  return (
    <group position={position} scale={[size, size, size]}>
      {/* Pot */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.2, 0.15, 0.4, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>
      {/* Soil */}
      <mesh position={[0, 0.41, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 12]} />
        <meshStandardMaterial color="#1a0f0a" />
      </mesh>
      {/* Foliage (stacked spheres) */}
      <mesh position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color="#0a2a0a" emissive="#00ff41" emissiveIntensity={0.02} />
      </mesh>
      <mesh position={[0.1, 0.95, 0.05]}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshStandardMaterial color="#0a3a0a" emissive="#00ff41" emissiveIntensity={0.03} />
      </mesh>
      <mesh position={[-0.08, 0.9, -0.08]}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshStandardMaterial color="#082a08" emissive="#00ff41" emissiveIntensity={0.02} />
      </mesh>
      {/* Subtle green glow */}
      <pointLight position={[0, 0.8, 0]} color="#00ff41" intensity={0.05} distance={2} />
    </group>
  );
}

// Whiteboard on wall
function Whiteboard({ position, rotation = [0, 0, 0] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation.map(r => r * Math.PI / 180) as unknown as THREE.Euler}>
      {/* Board frame */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.0, 1.2, 0.05]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* White surface */}
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[1.85, 1.05, 0.01]} />
        <meshStandardMaterial color="#111" emissive="#00ff41" emissiveIntensity={0.02} />
      </mesh>
      {/* Marker tray */}
      <mesh position={[0, -0.65, 0.08]}>
        <boxGeometry args={[1.0, 0.05, 0.08]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

// Bookshelf against wall
function Bookshelf({ position, rotation = [0, 0, 0] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const shelfW = 1.5;
  const shelfH = 2.0;
  const shelfD = 0.35;
  const shelves = 4;

  return (
    <group position={position} rotation={rotation.map(r => r * Math.PI / 180) as unknown as THREE.Euler}>
      {/* Back panel */}
      <mesh position={[0, shelfH / 2, 0]}>
        <boxGeometry args={[shelfW, shelfH, 0.03]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Side panels */}
      {[-1, 1].map((side, i) => (
        <mesh key={`side-${i}`} position={[side * shelfW / 2, shelfH / 2, shelfD / 2]}>
          <boxGeometry args={[0.03, shelfH, shelfD]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {/* Shelves */}
      {Array.from({ length: shelves }).map((_, i) => (
        <mesh key={`shelf-${i}`} position={[0, (i + 0.5) * (shelfH / shelves), shelfD / 2]}>
          <boxGeometry args={[shelfW, 0.03, shelfD]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {/* Books (colored blocks) */}
      {[
        [0.3, 0.85, '#1a3a1a'],
        [-0.2, 0.85, '#2a1a1a'],
        [0.5, 0.85, '#1a1a3a'],
        [-0.4, 1.35, '#3a2a1a'],
        [0.1, 1.35, '#1a2a2a'],
        [0.4, 1.35, '#2a1a2a'],
        [-0.3, 1.85, '#1a3a2a'],
        [0.2, 1.85, '#2a2a1a'],
      ].map(([x, y, c], i) => (
        <mesh key={`book-${i}`} position={[x as number, y as number, shelfD / 2]}>
          <boxGeometry args={[0.12, 0.25, 0.2]} />
          <meshStandardMaterial color={c as string} emissive={c as string} emissiveIntensity={0.03} />
        </mesh>
      ))}
    </group>
  );
}

// Coffee station
function CoffeeStation({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Counter */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.2, 1.0, 0.6]} />
        <meshStandardMaterial color="#111" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Counter top */}
      <mesh position={[0, 1.01, 0]}>
        <boxGeometry args={[1.3, 0.03, 0.7]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.4} />
      </mesh>
      {/* Coffee machine */}
      <mesh position={[0.2, 1.25, 0]}>
        <boxGeometry args={[0.3, 0.45, 0.25]} />
        <meshStandardMaterial color="#0a0a0a" emissive="#00ff41" emissiveIntensity={0.08} />
      </mesh>
      {/* Machine light */}
      <pointLight position={[0.2, 1.3, 0.2]} color="#00ff41" intensity={0.08} distance={1} />
      {/* Cup */}
      <mesh position={[-0.3, 1.1, 0.05]}>
        <cylinderGeometry args={[0.05, 0.04, 0.1, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

// Wall-mounted TV/monitor screen
function WallScreen({ position, rotation = [0, 0, 0], color = '#00ff41' }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) {
  return (
    <group position={position} rotation={rotation.map(r => r * Math.PI / 180) as unknown as THREE.Euler}>
      {/* Bezel */}
      <mesh>
        <boxGeometry args={[1.6, 0.9, 0.04]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.5} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0, 0.025]}>
        <boxGeometry args={[1.45, 0.78, 0.01]} />
        <meshStandardMaterial color="#020a02" emissive={color} emissiveIntensity={0.12} />
      </mesh>
      {/* Screen glow */}
      <pointLight position={[0, 0, 0.3]} color={color} intensity={0.2} distance={3} />
    </group>
  );
}

// Water cooler
function WaterCooler({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.35, 0.7, 0.35]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.3} />
      </mesh>
      {/* Water bottle */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.5, 12]} />
        <meshPhysicalMaterial color="#0a2a3a" transparent opacity={0.4} roughness={0.1} />
      </mesh>
      {/* Cap */}
      <mesh position={[0, 1.16, 0]}>
        <cylinderGeometry args={[0.13, 0.12, 0.03, 12]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Status LED */}
      <pointLight position={[0.18, 0.55, 0.18]} color="#00ff41" intensity={0.05} distance={0.5} />
    </group>
  );
}

// Coat rack
function CoatRack({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Pole */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.8, 8]} />
        <meshStandardMaterial color="#222" metalness={0.6} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 6]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.5} />
      </mesh>
      {/* Hooks */}
      {[0, 1, 2, 3].map(i => {
        const angle = (i * Math.PI) / 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.15, 1.7, Math.sin(angle) * 0.15]} rotation={[0, -angle, Math.PI / 4]}>
            <cylinderGeometry args={[0.01, 0.01, 0.12, 6]} />
            <meshStandardMaterial color="#333" metalness={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

// Lounge sofa (2-seater)
function Sofa({ position, rotation = [0, 0, 0] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation.map(r => r * Math.PI / 180) as unknown as THREE.Euler}>
      {/* Seat */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.4, 0.2, 0.6]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.9} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.5, -0.25]}>
        <boxGeometry args={[1.4, 0.4, 0.1]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.9} />
      </mesh>
      {/* Armrests */}
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[side * 0.65, 0.38, 0]}>
          <boxGeometry args={[0.1, 0.25, 0.6]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.9} />
        </mesh>
      ))}
      {/* Legs */}
      {[[-0.55, 0.07, 0.2], [0.55, 0.07, 0.2], [-0.55, 0.07, -0.2], [0.55, 0.07, -0.2]].map((pos, i) => (
        <mesh key={`leg-${i}`} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.025, 0.025, 0.14, 6]} />
          <meshStandardMaterial color="#222" metalness={0.5} />
        </mesh>
      ))}
      {/* Cushion accent line */}
      <mesh position={[0, 0.36, 0.1]}>
        <boxGeometry args={[1.2, 0.01, 0.02]} />
        <meshBasicMaterial color="#00ff41" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

// Matrix pixel-art rug — code rain columns made of small glowing blocks
function MatrixRug({ position, size = [2.5, 3], seed = 0 }: {
  position: [number, number, number];
  size?: [number, number];
  seed?: number;
}) {
  const pixelSize = 0.12;
  const cols = Math.floor(size[0] / pixelSize);
  const rows = Math.floor(size[1] / pixelSize);

  // Deterministic "random" from seed
  const hash = (a: number, b: number) => {
    const x = Math.sin(a * 127.1 + b * 311.7 + seed * 73.37) * 43758.5453;
    return x - Math.floor(x);
  };

  // Generate pixel pattern — sparse code rain columns
  const pixels: { x: number; z: number; brightness: number }[] = [];
  for (let c = 0; c < cols; c++) {
    if (hash(c, 999) > 0.35) continue; // only ~35% of columns active
    const colHeight = Math.floor(hash(c, 0) * rows * 0.6) + 3;
    const startRow = Math.floor(hash(c, 1) * (rows - colHeight));
    for (let r = startRow; r < startRow + colHeight && r < rows; r++) {
      const distFromHead = r - startRow;
      const brightness = Math.max(0.05, 1 - distFromHead / colHeight);
      if (hash(c, r) > 0.6) continue; // gaps in the stream
      pixels.push({
        x: (c - cols / 2) * pixelSize,
        z: (r - rows / 2) * pixelSize,
        brightness,
      });
    }
  }

  return (
    <group position={position}>
      {/* Dark base mat */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <planeGeometry args={size} />
        <meshStandardMaterial color="#010301" />
      </mesh>
      {/* Border glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[size[0] + 0.06, size[1] + 0.06]} />
        <meshBasicMaterial color="#00ff41" transparent opacity={0.04} side={THREE.DoubleSide} />
      </mesh>
      {/* Matrix pixels */}
      {pixels.map((px, i) => (
        <mesh key={i} position={[px.x, 0.006, px.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[pixelSize * 0.85, pixelSize * 0.85]} />
          <meshBasicMaterial
            color="#00ff41"
            transparent
            opacity={px.brightness * 0.35}
          />
        </mesh>
      ))}
      {/* Soft green glow */}
      <pointLight position={[0, 0.15, 0]} color="#00ff41" intensity={0.06} distance={2.5} />
    </group>
  );
}

// Server rack / mini rack
function ServerRack({ position, rotation = [0, 0, 0] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation.map(r => r * Math.PI / 180) as unknown as THREE.Euler}>
      {/* Rack body */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[0.6, 1.6, 0.4]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.4} />
      </mesh>
      {/* Front panel lines */}
      {[0.3, 0.6, 0.9, 1.2].map((y, i) => (
        <mesh key={i} position={[0, y, 0.21]}>
          <boxGeometry args={[0.5, 0.15, 0.01]} />
          <meshStandardMaterial color="#111" emissive="#00ff41" emissiveIntensity={0.03} />
        </mesh>
      ))}
      {/* Status LEDs */}
      {[0.35, 0.65, 0.95, 1.25].map((y, i) => (
        <pointLight key={`led-${i}`} position={[0.25, y, 0.22]} color={i % 2 === 0 ? '#00ff41' : '#00aaff'} intensity={0.03} distance={0.5} />
      ))}
    </group>
  );
}

// Wall poster / frame
function WallPoster({ position, rotation = [0, 0, 0], color = '#00ff41' }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) {
  return (
    <group position={position} rotation={rotation.map(r => r * Math.PI / 180) as unknown as THREE.Euler}>
      {/* Frame */}
      <mesh>
        <boxGeometry args={[0.6, 0.8, 0.02]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Art */}
      <mesh position={[0, 0, 0.015]}>
        <boxGeometry args={[0.5, 0.7, 0.005]} />
        <meshStandardMaterial color="#050505" emissive={color} emissiveIntensity={0.06} />
      </mesh>
    </group>
  );
}

// Wall clock
function WallClock({ position, rotation = [0, 0, 0] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation.map(r => r * Math.PI / 180) as unknown as THREE.Euler}>
      {/* Clock face */}
      <mesh>
        <cylinderGeometry args={[0.25, 0.25, 0.03, 24]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Rim */}
      <mesh>
        <torusGeometry args={[0.25, 0.015, 8, 24]} />
        <meshStandardMaterial color="#222" metalness={0.6} />
      </mesh>
      {/* Center dot */}
      <mesh position={[0, 0, 0.02]}>
        <cylinderGeometry args={[0.02, 0.02, 0.01, 8]} />
        <meshBasicMaterial color="#00ff41" />
      </mesh>
      {/* Hour marks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * Math.PI * 2) / 12;
        return (
          <mesh key={i} position={[Math.sin(angle) * 0.2, Math.cos(angle) * 0.2, 0.02]}>
            <boxGeometry args={[0.01, 0.04, 0.005]} />
            <meshBasicMaterial color="#00ff41" transparent opacity={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

// Trash bin
function TrashBin({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.13, 0.1, 0.4, 10]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.3} />
      </mesh>
      {/* Rim */}
      <mesh position={[0, 0.4, 0]}>
        <torusGeometry args={[0.13, 0.01, 6, 10]} />
        <meshStandardMaterial color="#222" metalness={0.5} />
      </mesh>
    </group>
  );
}

// Neon wall sign — glowing text-like strip
function NeonSign({ position, rotation = [0, 0, 0], width = 1.2, color = '#00ff41' }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  color?: string;
}) {
  return (
    <group position={position} rotation={rotation.map(r => r * Math.PI / 180) as unknown as THREE.Euler}>
      {/* Backing plate */}
      <mesh>
        <boxGeometry args={[width, 0.3, 0.02]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      {/* Neon tube */}
      <mesh position={[0, 0, 0.015]}>
        <boxGeometry args={[width * 0.85, 0.06, 0.01]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      {/* Second line */}
      <mesh position={[width * 0.1, -0.1, 0.015]}>
        <boxGeometry args={[width * 0.5, 0.04, 0.01]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      <pointLight position={[0, 0, 0.15]} color={color} intensity={0.3} distance={3} />
    </group>
  );
}

// Kanban board — task board with colored cards
function KanbanBoard({ position, rotation = [0, 0, 0] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const cardColors = ['#00ff41', '#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899', '#ef4444', '#22c55e', '#00d4ff'];
  return (
    <group position={position} rotation={rotation.map(r => r * Math.PI / 180) as unknown as THREE.Euler}>
      {/* Board background */}
      <mesh>
        <boxGeometry args={[2.2, 1.4, 0.03]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Column dividers */}
      {[-0.37, 0.37].map((x, i) => (
        <mesh key={i} position={[x, 0, 0.02]}>
          <boxGeometry args={[0.005, 1.2, 0.005]} />
          <meshBasicMaterial color="#00ff41" transparent opacity={0.3} />
        </mesh>
      ))}
      {/* Column headers */}
      {[[-0.73, 'TODO'], [0, 'IN PROG'], [0.73, 'DONE']].map(([x, _label], i) => (
        <mesh key={`h-${i}`} position={[x as number, 0.55, 0.02]}>
          <boxGeometry args={[0.65, 0.08, 0.005]} />
          <meshBasicMaterial color="#00ff41" transparent opacity={0.2} />
        </mesh>
      ))}
      {/* Sticky note cards */}
      {cardColors.map((c, i) => {
        const col = i < 3 ? -0.73 : i < 5 ? 0 : 0.73;
        const row = i < 3 ? i : i < 5 ? i - 3 : i - 5;
        return (
          <mesh key={i} position={[col + (i % 2) * 0.08, 0.3 - row * 0.28, 0.02]}>
            <boxGeometry args={[0.28, 0.2, 0.005]} />
            <meshStandardMaterial color="#0a0a0a" emissive={c} emissiveIntensity={0.12} />
          </mesh>
        );
      })}
    </group>
  );
}

// Small coffee table (between sofas)
function CoffeeTableSmall({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Top */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.8, 0.03, 0.5]} />
        <meshStandardMaterial color="#111" roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Legs */}
      {[[-0.3, 0.17, -0.18], [0.3, 0.17, -0.18], [-0.3, 0.17, 0.18], [0.3, 0.17, 0.18]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <cylinderGeometry args={[0.02, 0.02, 0.34, 6]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.5} />
        </mesh>
      ))}
      {/* Magazine on top */}
      <mesh position={[0.1, 0.37, 0.05]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.2, 0.008, 0.15]} />
        <meshStandardMaterial color="#0a1a0a" emissive="#00ff41" emissiveIntensity={0.04} />
      </mesh>
      {/* Cup on top */}
      <mesh position={[-0.2, 0.4, -0.05]}>
        <cylinderGeometry args={[0.035, 0.03, 0.08, 8]} />
        <meshStandardMaterial color="#1a1a1a" emissive="#f59e0b" emissiveIntensity={0.03} />
      </mesh>
    </group>
  );
}

// Floor cable channel — colored strip on ground
function CableTrack({ from, to, color = '#00ff41' }: {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
}) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[2] + to[2]) / 2;

  return (
    <mesh position={[cx, 0.008, cz]} rotation={[0, angle, 0]}>
      <boxGeometry args={[0.06, 0.005, length]} />
      <meshBasicMaterial color={color} transparent opacity={0.08} />
    </mesh>
  );
}

// Wall-mounted floating shelf with small items
function WallShelf({ position, rotation = [0, 0, 0] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation.map(r => r * Math.PI / 180) as unknown as THREE.Euler}>
      {/* Shelf plank */}
      <mesh>
        <boxGeometry args={[0.8, 0.025, 0.2]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Bracket */}
      {[-0.3, 0.3].map((x, i) => (
        <mesh key={i} position={[x, -0.08, -0.08]}>
          <boxGeometry args={[0.02, 0.15, 0.02]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.5} />
        </mesh>
      ))}
      {/* Small trophy/figurine */}
      <mesh position={[-0.15, 0.07, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.12, 8]} />
        <meshStandardMaterial color="#1a1a1a" emissive="#f59e0b" emissiveIntensity={0.08} />
      </mesh>
      {/* Small cube */}
      <mesh position={[0.15, 0.04, 0]}>
        <boxGeometry args={[0.06, 0.06, 0.06]} />
        <meshStandardMaterial color="#0a0a0a" emissive="#8b5cf6" emissiveIntensity={0.06} />
      </mesh>
      {/* Photo frame */}
      <mesh position={[0, 0.06, -0.06]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.1, 0.08, 0.005]} />
        <meshStandardMaterial color="#1a1a1a" emissive="#00ff41" emissiveIntensity={0.03} />
      </mesh>
    </group>
  );
}

// Fire extinguisher
function FireExtinguisher({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Body */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.4, 10]} />
        <meshStandardMaterial color="#1a0505" emissive="#ff2222" emissiveIntensity={0.04} />
      </mesh>
      {/* Handle */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.04, 0.04, 0.04]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.5} />
      </mesh>
      {/* Nozzle */}
      <mesh position={[0.04, 0.5, 0]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.008, 0.008, 0.08, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

// Sticky notes cluster on wall
function StickyNotes({ position, rotation = [0, 0, 0] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const notes = [
    { x: 0, y: 0, color: '#1a2a0a', emissive: '#00ff41' },
    { x: 0.14, y: 0.02, color: '#2a1a0a', emissive: '#f59e0b' },
    { x: -0.12, y: 0.13, color: '#0a1a2a', emissive: '#3b82f6' },
    { x: 0.06, y: 0.15, color: '#2a0a1a', emissive: '#ec4899' },
    { x: -0.05, y: -0.12, color: '#1a0a2a', emissive: '#8b5cf6' },
  ];
  return (
    <group position={position} rotation={rotation.map(r => r * Math.PI / 180) as unknown as THREE.Euler}>
      {notes.map((n, i) => (
        <mesh key={i} position={[n.x, n.y, 0.005 * i]}>
          <boxGeometry args={[0.12, 0.12, 0.003]} />
          <meshStandardMaterial color={n.color} emissive={n.emissive} emissiveIntensity={0.08} />
        </mesh>
      ))}
    </group>
  );
}

// LED wall strip — thin glowing line along an axis
function LEDStrip({ from, to, color = '#00ff41', intensity = 0.15 }: {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  intensity?: number;
}) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx * dx + dz * dz) || 0.1;
  const angle = Math.atan2(dx, dz);
  const cx = (from[0] + to[0]) / 2;
  const cy = (from[1] + to[1]) / 2;
  const cz = (from[2] + to[2]) / 2;

  return (
    <group position={[cx, cy, cz]}>
      <mesh rotation={[0, angle, 0]}>
        <boxGeometry args={[0.02, 0.02, length]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
      <pointLight color={color} intensity={intensity} distance={4} />
    </group>
  );
}

// Desk lamp (small accent light)
function DeskLamp({ position, color = '#00ff41' }: {
  position: [number, number, number];
  color?: string;
}) {
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.02, 10]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.5} />
      </mesh>
      {/* Arm */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.28, 6]} />
        <meshStandardMaterial color="#222" metalness={0.6} />
      </mesh>
      {/* Shade */}
      <mesh position={[0.03, 0.28, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.06, 0.08, 8, 1, true]} />
        <meshStandardMaterial color="#1a1a1a" side={THREE.DoubleSide} />
      </mesh>
      {/* Light */}
      <pointLight position={[0.03, 0.25, 0]} color={color} intensity={0.15} distance={1.5} />
    </group>
  );
}

// Matrix-style floor — pure black with bright green grid
function RoomFloor() {
  return (
    <>
      {/* Pure black base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[FLOOR_SIZE.w, FLOOR_SIZE.d]} />
        <meshStandardMaterial color="#010101" roughness={0.95} />
      </mesh>
      {/* Matrix grid overlay */}
      <Grid
        args={[FLOOR_SIZE.w, FLOOR_SIZE.d]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#00ff41"
        sectionSize={2}
        sectionThickness={1.0}
        sectionColor="#00ff41"
        fadeDistance={22}
        fadeStrength={1.2}
        position={[0, 0.001, 0]}
      />
    </>
  );
}

// Room label
function RoomLabel({ text, position }: { text: string; position: [number, number, number] }) {
  return (
    <Html position={position} center style={{ pointerEvents: 'none' }}>
      <div className="font-mono text-[9px] text-hacker-green/40 uppercase tracking-widest">
        {text}
      </div>
    </Html>
  );
}

// Floor ring under agents at desk
function FloorRing({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={[position[0], 0.02, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.55, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.12} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ═══ BUBBLE COMPONENTS ═══

function SleepBubble({ position, name, color }: { position: [number, number, number]; name: string; color: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Html position={[position[0], position[1] + 2.0, position[2]]} center style={{ pointerEvents: 'auto' }}>
      {!expanded ? (
        <div
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="font-mono select-none cursor-pointer"
          style={{
            background: 'rgba(10, 10, 10, 0.8)',
            border: '1px solid rgba(0, 255, 65, 0.3)',
            borderRadius: '6px',
            padding: '1px 6px',
            animation: 'sleepPulse 2.5s ease-in-out infinite',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <span style={{ fontSize: '6px', fontWeight: 700, color, opacity: 0.8 }}>{name}</span>
          <span style={{ color: '#00ff41', fontSize: '6px', fontWeight: 700, textShadow: '0 0 4px rgba(0, 255, 65, 0.4)' }}>ZzzZz</span>
        </div>
      ) : (
        <div
          className="font-mono text-center select-none"
          style={{
            background: 'rgba(10, 10, 10, 0.9)',
            border: '1px solid rgba(0, 255, 65, 0.4)',
            borderRadius: '8px',
            padding: '6px 10px',
            animation: 'bubbleExpand 0.25s ease-out forwards',
            position: 'relative',
          }}
        >
          <div
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            className="cursor-pointer"
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: '#222',
              border: '1px solid rgba(0, 255, 65, 0.4)',
              color: '#00ff41',
              fontSize: '8px',
              lineHeight: '12px',
              textAlign: 'center',
            }}
          >
            ✕
          </div>
          <div className="font-mono text-[8px] font-bold mb-1" style={{ color }}>
            {name}
          </div>
          <span
            className="text-[10px] font-bold tracking-wider"
            style={{
              color: '#00ff41',
              textShadow: '0 0 6px rgba(0, 255, 65, 0.5)',
              animation: 'sleepFloat 3s ease-in-out infinite',
              display: 'inline-block',
            }}
          >
            ZzzzZZzzZ
          </span>
          <div className="text-[7px] mt-1" style={{ color: '#484f58' }}>IDLE</div>
        </div>
      )}
      <style>{`
        @keyframes sleepPulse {
          0%, 100% { opacity: 0.5; transform: translateY(0px); }
          50% { opacity: 0.9; transform: translateY(-2px); }
        }
        @keyframes sleepFloat {
          0%, 100% { transform: scale(0.9); }
          50% { transform: scale(1.1); }
        }
        @keyframes bubbleExpand {
          0% { opacity: 0; transform: scale(0.6); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </Html>
  );
}

function SpeechBubble({
  name, color, thought, status, position,
}: {
  name: string; color: string; thought: string; status: string; position: [number, number, number];
}) {
  const [expanded, setExpanded] = useState(false);
  const displayText = status === 'discussing' ? '💬 ' + thought : thought;
  const icon = status === 'discussing' ? '⟩⟩' : '>_';

  return (
    <Html position={[position[0], position[1] + 2.2, position[2]]} center style={{ pointerEvents: 'auto' }}>
      {!expanded ? (
        <div
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="cursor-pointer select-none"
          style={{
            background: 'rgba(10, 10, 10, 0.85)',
            border: '1px solid rgba(0, 255, 65, 0.25)',
            borderRadius: '8px',
            padding: '1px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <span className="font-mono" style={{ fontSize: '6px', color: '#00ff41', opacity: 0.7 }}>{icon}</span>
          <span className="font-mono" style={{ fontSize: '6px', fontWeight: 700, color }}>{name}</span>
        </div>
      ) : (
        <div className="select-none" style={{ animation: 'bubbleExpand 0.25s ease-out forwards' }}>
          <div
            style={{
              background: '#fffef5',
              border: '2px solid #222',
              borderRadius: '12px',
              padding: '6px 10px',
              maxWidth: '160px',
              boxShadow: '2px 3px 0px rgba(0, 0, 0, 0.3)',
              position: 'relative',
            }}
          >
            <div
              onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
              className="cursor-pointer"
              style={{
                position: 'absolute', top: '-6px', right: '-6px',
                width: '14px', height: '14px', borderRadius: '50%',
                background: '#222', border: '1.5px solid #444',
                color: '#fff', fontSize: '8px', lineHeight: '12px', textAlign: 'center',
              }}
            >
              ✕
            </div>
            <div className="font-mono text-[10px] font-bold" style={{ color, marginBottom: '2px' }}>{name}</div>
            <div
              className="font-sans text-[10px] leading-tight"
              style={{
                color: '#1a1a1a',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {displayText}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
              <span className="font-mono text-[8px] uppercase" style={{ color: '#666' }}>{status}</span>
            </div>
          </div>
          <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid #222', margin: '0 auto', position: 'relative', top: '-1px' }} />
          <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #fffef5', margin: '-9px auto 0', position: 'relative' }} />
        </div>
      )}
      <style>{`
        @keyframes bubbleExpand {
          0% { opacity: 0; transform: scale(0.6); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </Html>
  );
}

// ═══ QUEST BUBBLE ═══
function QuestBubble({ position, name, color }: { position: [number, number, number]; name: string; color: string }) {
  return (
    <Html position={[position[0], position[1] + 2.2, position[2]]} center style={{ pointerEvents: 'none' }}>
      <div className="select-none" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
        {/* Quest "!" bubble */}
        <div
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: '#ef4444',
            border: '2px solid #f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 10px rgba(245, 158, 11, 0.6), 0 0 20px rgba(239, 68, 68, 0.3)',
            animation: 'questBounce 0.8s ease-in-out infinite',
          }}
        >
          <span style={{ color: '#fff', fontSize: '15px', fontWeight: 900, lineHeight: 1, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>!</span>
        </div>
        {/* Agent name tag */}
        <div
          className="font-mono"
          style={{
            fontSize: '7px',
            fontWeight: 700,
            color,
            textShadow: `0 0 4px ${color}`,
            opacity: 0.9,
          }}
        >
          {name}
        </div>
      </div>
      <style>{`
        @keyframes questBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-6px) scale(1.1); }
          60% { transform: translateY(-2px) scale(0.95); }
        }
      `}</style>
    </Html>
  );
}

// ═══ HABBO CHAT STACK ═══
// Agent name → color lookup
const SPEAKER_COLORS: Record<string, string> = {
  'CEO': '#f59e0b',
  'Kira': '#8b5cf6',
  'Madara': '#22c55e',
  'Stark': '#ec4899',
  'L': '#3b82f6',
  'Usopp': '#ef4444',
};

interface ChatMessage {
  id: number;
  speaker: string;
  text: string;
  color: string;
  createdAt: number;
}

function HabboChatStack({ conversationLog, isDiscussing }: { conversationLog?: ConversationTurn[]; isDiscussing: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const lastProcessedTurn = useRef(-1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Add new messages as conversation_log grows (real-time via Supabase)
  useEffect(() => {
    if (!conversationLog || conversationLog.length === 0) return;

    const newTurns = conversationLog.filter(t => t.turn > lastProcessedTurn.current);
    if (newTurns.length === 0) return;

    const newMessages: ChatMessage[] = newTurns.map(t => {
      lastProcessedTurn.current = t.turn;
      return {
        id: t.turn,
        speaker: t.speaker,
        text: t.dialogue || t.message || '',
        color: SPEAKER_COLORS[t.speaker] || '#00ff41',
        createdAt: Date.now(),
      };
    });

    setMessages(prev => [...prev, ...newMessages]);
  }, [conversationLog]);

  // Scroll up animation: every 1.5s, remove messages older than 12s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages(prev => prev.filter(m => now - m.createdAt < 12000));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Reset when discussion ends
  useEffect(() => {
    if (!isDiscussing) {
      setMessages([]);
      lastProcessedTurn.current = -1;
    }
  }, [isDiscussing]);

  if (messages.length === 0) return null;

  return (
    <Html position={[7, 4.5, 0]} center style={{ pointerEvents: 'none' }}>
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          width: '380px',
          maxHeight: '160px',
          overflow: 'hidden',
        }}
      >
        {messages.map((msg, idx) => {
          const age = (Date.now() - msg.createdAt) / 1000;
          // Scroll up: older messages move higher
          const translateY = -age * 3;
          // Fade out in last 3 seconds of life
          const opacity = age > 9 ? Math.max(0, 1 - (age - 9) / 3) : 1;

          return (
            <div
              key={`${msg.id}-${idx}`}
              style={{
                transform: `translateY(${translateY}px)`,
                opacity,
                transition: 'transform 1.5s linear, opacity 1.5s linear',
              }}
            >
              {/* Habbo-style wide bubble */}
              <div
                style={{
                  background: '#fffef5',
                  border: `1.5px solid ${msg.color}`,
                  borderRadius: '10px',
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '1px 2px 0px rgba(0, 0, 0, 0.12)',
                  animation: idx === messages.length - 1 ? 'habboSlideIn 0.3s ease-out' : undefined,
                }}
              >
                {/* Avatar dot */}
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    minWidth: '14px',
                    borderRadius: '50%',
                    background: msg.color,
                    boxShadow: `0 0 3px ${msg.color}`,
                  }}
                />
                {/* Name + Text on same line */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: msg.color,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {msg.speaker}:
                  </span>
                  <span
                    className="font-sans"
                    style={{
                      fontSize: '10px',
                      lineHeight: 1.3,
                      color: '#1a1a1a',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.text}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes habboSlideIn {
          0% { opacity: 0; transform: translateY(8px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </Html>
  );
}

// ═══ AGENT STATION ═══
const allDeskPositions = agentConfigs.map(c => c.position);

function AgentStation({ config, configIndex, teleportToMeeting }: { config: typeof agentConfigs[0]; configIndex: number; teleportToMeeting: boolean }) {
  // Poll shared Float32Arrays via useFrame to track live agent position + internal state
  const [internalStateCode, setInternalStateCode] = useState(0);
  const [livePos, setLivePos] = useState<[number, number, number]>(config.position);
  useFrame(() => {
    const code = SHARED_INTERNAL_STATES[configIndex];
    if (code !== internalStateCode) setInternalStateCode(code);

    const lx = SHARED_POSITIONS[configIndex * 2];
    const lz = SHARED_POSITIONS[configIndex * 2 + 1];
    if (Math.abs(lx - livePos[0]) > 0.05 || Math.abs(lz - livePos[2]) > 0.05) {
      setLivePos([lx, 0, lz]);
    }
  });

  const isQuestReceived = internalStateCode === INTERNAL_STATE_CODES['quest-received'];

  const showSleepBubble = config.status === 'idle';
  const showWorkBubble = config.status === 'working';
  const showQuestBubble = config.status === 'discussing' && isQuestReceived;

  return (
    <>
      <AgentModel
        modelPath={config.model}
        position={config.position}
        rotation={config.rotation}
        scale={0.8}
        status={config.status}
        color={config.color}
        allAgentPositions={allDeskPositions}
        meetingPositions={meetingSeatPositions}
        roamWaypoints={ROAM_WAYPOINTS}
        agentIndex={configIndex}
        collisionData={COLLISION_DATA}
        sharedPositions={SHARED_POSITIONS}
        sharedInternalStates={SHARED_INTERNAL_STATES}
        totalAgents={6}
        teleportToMeeting={teleportToMeeting}
      />

      {/* Chair at desk */}
      <Chair
        position={[
          config.position[0] + (configIndex % 2 === 0 ? -0.6 : 0.6),
          0,
          config.position[2],
        ]}
        color={config.color}
        faceRight={configIndex % 2 === 0}
      />

      <FloorRing position={config.position} color={config.color} />

      {/* Idle → sleep bubble (at desk) */}
      {showSleepBubble && (
        <SleepBubble position={config.position} name={config.name} color={config.color} />
      )}

      {/* Working → standard speech bubble (at desk) */}
      {showWorkBubble && (
        <SpeechBubble
          name={config.name}
          color={config.color}
          thought={config.thought}
          status={config.status}
          position={config.position}
        />
      )}

      {/* Quest received → "!" bubble follows agent live position */}
      {showQuestBubble && (
        <QuestBubble position={livePos} name={config.name} color={config.color} />
      )}
    </>
  );
}

// ═══ CAMERA ═══
function CameraControls({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={true}
      minDistance={16}
      maxDistance={45}
      maxPolarAngle={Math.PI / 3}
      minPolarAngle={Math.PI / 6}
      autoRotate={false}
      target={[0, 0, 0]}
    />
  );
}

function CameraResetter({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  const { camera } = useThree();
  const initialized = useRef(false);

  if (!initialized.current && typeof window !== 'undefined') {
    initialized.current = true;
    if (window.innerWidth < 640 && (camera as THREE.PerspectiveCamera).fov) {
      (camera as THREE.PerspectiveCamera).fov = 42;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }

  const resetCamera = useCallback(() => {
    camera.position.set(...DEFAULT_CAM_POS);
    if (controlsRef.current) {
      controlsRef.current.target.copy(DEFAULT_CAM_TARGET);
      controlsRef.current.update();
    }
  }, [camera, controlsRef]);

  if (typeof window !== 'undefined') {
    (window as any).__resetStageCamera = resetCamera;
  }

  return null;
}

// ═══ MAIN COMPONENT ═══
export type AgentStatus = 'idle' | 'working' | 'discussing' | 'roaming';

export interface ConversationTurn {
  speaker: string;
  dialogue?: string;
  message?: string;
  turn: number;
  timestamp?: string;
}

export interface AgentLiveData {
  id: string;
  status: AgentStatus;
  thought: string;
}

export default function HQRoom3D({ liveAgents, conversationLog }: { liveAgents?: AgentLiveData[]; conversationLog?: ConversationTurn[] }) {
  const controlsRef = useRef<any>(null);

  const handleResetCamera = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).__resetStageCamera) {
      (window as any).__resetStageCamera();
    }
  }, []);

  const mergedConfigs = agentConfigs.map(config => {
    const live = liveAgents?.find(a => a.id === config.id);
    if (live) return { ...config, status: live.status, thought: live.thought };
    return config;
  });

  // If conversation has turns, discussion is in progress → teleport agents to seats on mount
  const discussionInProgress = (conversationLog?.length ?? 0) > 0;

  return (
    <Room3DErrorBoundary>
    <div className="w-full h-[360px] sm:h-[520px] relative">
      <Canvas
        camera={{ position: DEFAULT_CAM_POS, fov: DEFAULT_CAM_FOV }}
        shadows
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
        orthographic={false}
      >
        {/* ── Lighting — bright office ── */}
        <ambientLight intensity={1.2} />
        <directionalLight position={[8, 14, 6]} intensity={1.5} color="#ffffff" />
        <directionalLight position={[-8, 12, -6]} intensity={0.8} color="#ffffff" />
        <directionalLight position={[0, 16, 0]} intensity={0.6} color="#eeffee" />

        {/* Colored ambient fills — workspace & conference */}
        <pointLight position={[-7, 5, -5]} intensity={0.6} color="#00d4ff" distance={16} />
        <pointLight position={[-7, 5,  5]} intensity={0.6} color="#00d4ff" distance={16} />
        <pointLight position={[-7, 5,  0]} intensity={0.5} color="#00d4ff" distance={16} />
        <pointLight position={[7, 5, -4]} intensity={0.5} color="#00ff41" distance={16} />
        <pointLight position={[7, 5,  4]} intensity={0.5} color="#00ff41" distance={16} />
        <pointLight position={[7, 5,  0]} intensity={0.5} color="#00ff41" distance={16} />

        {/* Floor fill lights — prevent dark floor */}
        <pointLight position={[-6, 1.5, 0]} intensity={0.4} color="#ffffff" distance={10} />
        <pointLight position={[6, 1.5, 0]} intensity={0.4} color="#ffffff" distance={10} />

        <hemisphereLight args={['#2a3a2a', '#1a1a1a', 0.8]} />
        <fog attach="fog" args={['#0a0a0a', 40, 65]} />

        <Suspense fallback={null}>
          {/* ── Room structure ── */}
          <RoomFloor />
          <RoomWalls />
          <GlassPartition />

          {/* ── Room labels ── */}
          <RoomLabel text="// workspace" position={[-6.5, WALL_HEIGHT + 0.1, -FLOOR_SIZE.d / 2 + 0.3]} />
          <RoomLabel text="// conference" position={[7, WALL_HEIGHT + 0.1, -FLOOR_SIZE.d / 2 + 0.3]} />

          {/* ── Desk islands ── */}
          <DeskIsland
            position={ISLAND_CENTERS[0]}
            colorLeft={agentConfigs[0].color}
            colorRight={agentConfigs[1].color}
          />
          <DeskIsland
            position={ISLAND_CENTERS[1]}
            colorLeft={agentConfigs[2].color}
            colorRight={agentConfigs[3].color}
          />
          <DeskIsland
            position={ISLAND_CENTERS[2]}
            colorLeft={agentConfigs[4].color}
            colorRight={agentConfigs[5].color}
          />

          {/* ── Conference table ── */}
          <ConferenceTable position={MEETING_TABLE_POS} />

          {/* ── Decorations ── */}

          {/* Plants — corners and corridors */}
          <Plant position={[-11.5, 0, -7.5]} size={1.2} />
          <Plant position={[-11.5, 0,  7.5]} size={1.0} />
          <Plant position={[11.5, 0, -7.5]} size={1.1} />
          <Plant position={[11.5, 0,  7.5]} size={0.9} />
          <Plant position={[-2, 0, -7.5]} size={0.8} />
          <Plant position={[-2, 0,  7.5]} size={0.8} />
          <Plant position={[3, 0, -7]} size={0.7} />
          <Plant position={[3, 0,  7]} size={0.7} />
          <Plant position={[-11, 0, 0]} size={0.6} />

          {/* Whiteboards */}
          <Whiteboard position={[-6.5, 1.8, -FLOOR_SIZE.d / 2 + 0.1]} />
          <Whiteboard position={[FLOOR_SIZE.w / 2 - 0.1, 1.8, 0]} rotation={[0, -90, 0]} />

          {/* Bookshelves on left wall */}
          <Bookshelf position={[-FLOOR_SIZE.w / 2 + 0.2, 0, -5]} rotation={[0, 90, 0]} />
          <Bookshelf position={[-FLOOR_SIZE.w / 2 + 0.2, 0,  0]} rotation={[0, 90, 0]} />
          <Bookshelf position={[-FLOOR_SIZE.w / 2 + 0.2, 0,  5]} rotation={[0, 90, 0]} />

          {/* Coffee station + water cooler */}
          <CoffeeStation position={[-2, 0, 7]} />
          <WaterCooler position={[-3, 0, 7.5]} />

          {/* TV screens — workspace + conference */}
          <WallScreen position={[-3, 2, -FLOOR_SIZE.d / 2 + 0.1]} color="#00d4ff" />
          <WallScreen position={[7, 2, -FLOOR_SIZE.d / 2 + 0.1]} color="#00ff41" />

          {/* Coat rack near entrance */}
          <CoatRack position={[0.5, 0, -5]} />

          {/* Lounge area — sofa + Matrix rugs */}
          <Sofa position={[10.5, 0, 6.5]} rotation={[0, -90, 0]} />
          <Sofa position={[10.5, 0, -6.5]} rotation={[0, -90, 0]} />
          <MatrixRug position={[10.5, 0, 6.5]} size={[2.5, 3]} seed={1} />
          <MatrixRug position={[10.5, 0, -6.5]} size={[2.5, 3]} seed={2} />

          {/* Matrix rugs under desk islands */}
          <MatrixRug position={[-6.5, 0, -5]} size={[5, 2.5]} seed={3} />
          <MatrixRug position={[-6.5, 0,  0]} size={[5, 2.5]} seed={4} />
          <MatrixRug position={[-6.5, 0,  5]} size={[5, 2.5]} seed={5} />

          {/* Matrix rug under conference table */}
          <MatrixRug position={[7, 0, 0]} size={[5, 4]} seed={6} />

          {/* Corridor rug */}
          <MatrixRug position={[1.5, 0, 0]} size={[2, 6]} seed={7} />

          {/* Server rack near partition */}
          <ServerRack position={[0.5, 0, 7]} rotation={[0, -90, 0]} />

          {/* Wall posters — workspace walls */}
          <WallPoster position={[-10, 1.8, -FLOOR_SIZE.d / 2 + 0.1]} color="#f59e0b" />
          <WallPoster position={[-3.5, 1.8, -FLOOR_SIZE.d / 2 + 0.1]} color="#8b5cf6" />
          <WallPoster position={[FLOOR_SIZE.w / 2 - 0.1, 1.8, -4]} rotation={[0, -90, 0]} color="#ec4899" />
          <WallPoster position={[FLOOR_SIZE.w / 2 - 0.1, 1.8,  4]} rotation={[0, -90, 0]} color="#3b82f6" />

          {/* Wall clock — workspace front wall */}
          <WallClock position={[-6.5, 2.2, FLOOR_SIZE.d / 2 - 0.1]} rotation={[90, 0, 0]} />

          {/* Trash bins near desks */}
          <TrashBin position={[-3.5, 0, -5]} />
          <TrashBin position={[-3.5, 0,  5]} />
          <TrashBin position={[4, 0, 2.5]} />
          <TrashBin position={[-9.5, 0, -2.5]} />

          {/* ── NEW DECO — vivant ── */}

          {/* Neon signs on walls */}
          <NeonSign position={[-6.5, 2.5, FLOOR_SIZE.d / 2 - 0.1]} rotation={[0, 180, 0]} width={2} color="#00ff41" />
          <NeonSign position={[7, 2.5, FLOOR_SIZE.d / 2 - 0.1]} rotation={[0, 180, 0]} width={1.5} color="#00d4ff" />
          <NeonSign position={[-FLOOR_SIZE.w / 2 + 0.1, 2.3, -2.5]} rotation={[0, 90, 0]} width={1} color="#8b5cf6" />

          {/* Kanban board — workspace back wall */}
          <KanbanBoard position={[-9.5, 1.7, -FLOOR_SIZE.d / 2 + 0.1]} />

          {/* Coffee tables between sofas in lounge */}
          <CoffeeTableSmall position={[10.5, 0, 4.5]} />
          <CoffeeTableSmall position={[10.5, 0, -4.5]} />

          {/* Floor cable tracks — subtle green lines connecting desks */}
          <CableTrack from={[-8.5, 0, -5]} to={[-8.5, 0, 0]} />
          <CableTrack from={[-4.5, 0, 0]} to={[-4.5, 0, 5]} />
          <CableTrack from={[-6.5, 0, -5]} to={[-2, 0, -5]} />
          <CableTrack from={[-6.5, 0, 5]} to={[-2, 0, 7]} color="#f59e0b" />

          {/* Floating wall shelves */}
          <WallShelf position={[-FLOOR_SIZE.w / 2 + 0.25, 1.5, -2.5]} rotation={[0, 90, 0]} />
          <WallShelf position={[-FLOOR_SIZE.w / 2 + 0.25, 1.5,  2.5]} rotation={[0, 90, 0]} />
          <WallShelf position={[FLOOR_SIZE.w / 2 - 0.25, 1.5, -2]} rotation={[0, -90, 0]} />

          {/* Fire extinguishers — safety */}
          <FireExtinguisher position={[0, 0, -8]} />
          <FireExtinguisher position={[FLOOR_SIZE.w / 2 - 0.5, 0, 7.5]} />

          {/* Sticky notes clusters on walls */}
          <StickyNotes position={[-4, 1.5, -FLOOR_SIZE.d / 2 + 0.08]} />
          <StickyNotes position={[-8, 1.5, -FLOOR_SIZE.d / 2 + 0.08]} />
          <StickyNotes position={[5, 1.5, -FLOOR_SIZE.d / 2 + 0.08]} />
          <StickyNotes position={[10, 1.5, -FLOOR_SIZE.d / 2 + 0.08]} />

          {/* LED strips along walls — ambient glow */}
          <LEDStrip from={[-FLOOR_SIZE.w / 2, 0.05, -FLOOR_SIZE.d / 2]} to={[-FLOOR_SIZE.w / 2, 0.05, FLOOR_SIZE.d / 2]} color="#00ff41" intensity={0.08} />
          <LEDStrip from={[FLOOR_SIZE.w / 2, 0.05, -FLOOR_SIZE.d / 2]} to={[FLOOR_SIZE.w / 2, 0.05, FLOOR_SIZE.d / 2]} color="#00d4ff" intensity={0.08} />
          <LEDStrip from={[-FLOOR_SIZE.w / 2, WALL_HEIGHT - 0.05, -FLOOR_SIZE.d / 2]} to={[FLOOR_SIZE.w / 2, WALL_HEIGHT - 0.05, -FLOOR_SIZE.d / 2]} color="#00ff41" intensity={0.06} />

          {/* Desk lamps on conference table */}
          <DeskLamp position={[5.8, 0.72, -0.4]} color="#00ff41" />
          <DeskLamp position={[8.2, 0.72, 0.4]} color="#00d4ff" />

          {/* ── Agents ── */}
          {mergedConfigs.map((config, index) => (
            <AgentStation
              key={config.id}
              config={config}
              configIndex={index}
              teleportToMeeting={discussionInProgress}
            />
          ))}

          {/* ── Habbo Chat Stack (above meeting table) ── */}
          <HabboChatStack
            conversationLog={conversationLog}
            isDiscussing={mergedConfigs.some(c => c.status === 'discussing')}
          />
        </Suspense>

        <CameraControls controlsRef={controlsRef} />
        <CameraResetter controlsRef={controlsRef} />
      </Canvas>

      {/* Reset camera button */}
      <button
        onClick={handleResetCamera}
        className="absolute bottom-3 right-3 cursor-pointer font-mono"
        style={{
          background: 'rgba(10, 10, 10, 0.8)',
          border: '1px solid rgba(0, 255, 65, 0.3)',
          borderRadius: '6px',
          padding: '4px 8px',
          color: '#00ff41',
          fontSize: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.2s',
        }}
        title="Reset camera"
      >
        <span style={{ fontSize: '12px' }}>⟲</span>
        <span>reset_cam</span>
      </button>
    </div>
    </Room3DErrorBoundary>
  );
}
