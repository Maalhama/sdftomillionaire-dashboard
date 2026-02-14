'use client';

import { Suspense, useState, useRef, useCallback, Component, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import AgentModel from './AgentModel';

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
const DEFAULT_CAM_POS: [number, number, number] = [8, 14, 8];
const DEFAULT_CAM_FOV = 38;
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 0, 0);

// ═══ ROOM LAYOUT ═══
// Office area: left side — 2 rows of 3 desks
// Meeting area: right side — round table with seats

const WALL_HEIGHT = 2.5;
const WALL_COLOR = '#0d0d0d';
const WALL_EMISSIVE = '#00ff41';
const FLOOR_SIZE = { w: 14, d: 10 };

// Office desk positions (left side, compact 2x3 grid)
const deskPositions: [number, number, number][] = [
  [-4.5, 0, -2.5],  // CEO
  [-4.5, 0, 0],     // KIRA
  [-4.5, 0, 2.5],   // MADARA
  [-2, 0, -2.5],    // STARK
  [-2, 0, 0],       // L
  [-2, 0, 2.5],     // USOPP
];

// Meeting table position (right side)
const MEETING_TABLE_POS: [number, number, number] = [3.5, 0, 0];

// Meeting seat positions around the table
const meetingSeatPositions: [number, number, number][] = [
  [3.5, 0, -1.8],   // seat 0 (front)
  [5, 0, -0.9],     // seat 1
  [5, 0, 0.9],      // seat 2
  [3.5, 0, 1.8],    // seat 3 (back)
  [2, 0, 0.9],      // seat 4
  [2, 0, -0.9],     // seat 5
];

// Roam waypoints — positions scattered across both rooms for agents to walk through
const ROAM_WAYPOINTS: [number, number, number][] = [
  // Office area (left side)
  [-5.5, 0, -3.5],   // back-left corner
  [-5.5, 0, 3.5],    // front-left corner
  [-3.2, 0, -1.2],   // between desk rows top
  [-3.2, 0, 1.2],    // between desk rows bottom
  [-1, 0, -3.5],     // right of desks top
  [-1, 0, 3.5],      // right of desks bottom
  [-1, 0, 0],        // center right of desks
  // Doorway area
  [0.3, 0, 0],       // in the door
  // Meeting room (right side)
  [1.5, 0, -3.5],    // meeting room top-left
  [1.5, 0, 3.5],     // meeting room bottom-left
  [2.5, 0, -2],      // near table top-left
  [4.5, 0, -2],      // near table top-right
  [5.5, 0, 0],       // right of table
  [4.5, 0, 2],       // near table bottom-right
  [2.5, 0, 2],       // near table bottom-left
  [5.5, 0, -3.5],    // meeting room top-right corner
  [5.5, 0, 3.5],     // meeting room bottom-right corner
  [1.5, 0, 0],       // meeting room left center
];

// Agent configs — positions are at their desks
const agentConfigs = [
  {
    id: 'opus',
    name: 'CEO',
    role: 'CEO // Chef des Opérations',
    model: '/models/minion.glb',
    hasModel: true,
    deskIndex: 4,
    position: deskPositions[4],
    rotation: [0, 90, 0] as [number, number, number],
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
    rotation: [0, 90, 0] as [number, number, number],
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
    rotation: [0, 90, 0] as [number, number, number],
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
    rotation: [0, 90, 0] as [number, number, number],
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
    deskIndex: 0,
    position: deskPositions[0],
    rotation: [0, 90, 0] as [number, number, number],
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
    rotation: [0, 90, 0] as [number, number, number],
    status: 'idle' as AgentStatus,
    color: '#ef4444',
    thought: 'Surveillance active',
  },
];

// ═══ ROOM COMPONENTS ═══

// Wall segment
function Wall({ start, end, height = WALL_HEIGHT }: { start: [number, number]; end: [number, number]; height?: number }) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const cx = (start[0] + end[0]) / 2;
  const cz = (start[1] + end[1]) / 2;

  return (
    <mesh position={[cx, height / 2, cz]} rotation={[0, angle, 0]}>
      <boxGeometry args={[0.08, height, length]} />
      <meshStandardMaterial
        color={WALL_COLOR}
        emissive={WALL_EMISSIVE}
        emissiveIntensity={0.02}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

// Neon strip on top of walls
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
        <meshBasicMaterial color={WALL_EMISSIVE} transparent opacity={0.6} />
      </mesh>
      <pointLight position={[cx, WALL_HEIGHT + 0.1, cz]} color={WALL_EMISSIVE} intensity={0.3} distance={3} />
    </group>
  );
}

// Room structure with walls
function RoomWalls() {
  // Outer walls
  const outerWalls: [number, number][][] = [
    [[-FLOOR_SIZE.w / 2, -FLOOR_SIZE.d / 2], [FLOOR_SIZE.w / 2, -FLOOR_SIZE.d / 2]],   // front
    [[FLOOR_SIZE.w / 2, -FLOOR_SIZE.d / 2], [FLOOR_SIZE.w / 2, FLOOR_SIZE.d / 2]],      // right
    [[FLOOR_SIZE.w / 2, FLOOR_SIZE.d / 2], [-FLOOR_SIZE.w / 2, FLOOR_SIZE.d / 2]],      // back
    [[-FLOOR_SIZE.w / 2, FLOOR_SIZE.d / 2], [-FLOOR_SIZE.w / 2, -FLOOR_SIZE.d / 2]],    // left
  ];

  // Divider wall between office and meeting room (with gap for door)
  const dividerWalls: [number, number][][] = [
    [[0.3, -FLOOR_SIZE.d / 2], [0.3, -1.5]],  // divider top part
    [[0.3, 1.5], [0.3, FLOOR_SIZE.d / 2]],     // divider bottom part
  ];

  return (
    <group>
      {outerWalls.map((wall, i) => (
        <group key={`outer-${i}`}>
          <Wall start={wall[0]} end={wall[1]} />
          <NeonStrip start={wall[0]} end={wall[1]} />
        </group>
      ))}
      {dividerWalls.map((wall, i) => (
        <group key={`divider-${i}`}>
          <Wall start={wall[0]} end={wall[1]} height={2} />
          <NeonStrip start={wall[0]} end={wall[1]} />
        </group>
      ))}
    </group>
  );
}

// Office desk (facing right)
function Desk({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      {/* Table top */}
      <mesh position={[0.4, 0.45, 0]}>
        <boxGeometry args={[0.6, 0.04, 0.8]} />
        <meshStandardMaterial color="#111111" emissive={color} emissiveIntensity={0.03} />
      </mesh>
      {/* Legs */}
      {[[0.15, 0.22, -0.35], [0.65, 0.22, -0.35], [0.15, 0.22, 0.35], [0.65, 0.22, 0.35]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <boxGeometry args={[0.03, 0.44, 0.03]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh position={[0.6, 0.7, 0]}>
        <boxGeometry args={[0.02, 0.3, 0.45]} />
        <meshStandardMaterial color="#0a0a0a" emissive={color} emissiveIntensity={0.2} />
      </mesh>
      {/* Screen glow */}
      <pointLight color={color} intensity={0.2} distance={1.2} position={[0.5, 0.7, 0]} />
    </group>
  );
}

// Office chair
function Chair({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      {/* Seat */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.35, 0.04, 0.35]} />
        <meshStandardMaterial color="#0a0a0a" emissive={color} emissiveIntensity={0.05} />
      </mesh>
      {/* Back */}
      <mesh position={[-0.15, 0.5, 0]}>
        <boxGeometry args={[0.04, 0.35, 0.3]} />
        <meshStandardMaterial color="#0a0a0a" emissive={color} emissiveIntensity={0.03} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

// Meeting table (round)
function MeetingTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Table top */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.05, 32]} />
        <meshStandardMaterial color="#0d0d0d" emissive="#00ff41" emissiveIntensity={0.03} />
      </mesh>
      {/* Central pillar */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.1, 0.15, 0.5, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Hologram projector on table */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.03, 16]} />
        <meshBasicMaterial color="#00ff41" transparent opacity={0.5} />
      </mesh>
      <pointLight position={[0, 0.8, 0]} color="#00ff41" intensity={0.4} distance={3} />
      {/* Neon ring on floor */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.5, 32]} />
        <meshBasicMaterial color="#00ff41" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Floor with grid
function RoomFloor() {
  return (
    <>
      <Grid
        args={[FLOOR_SIZE.w, FLOOR_SIZE.d]}
        cellSize={0.5}
        cellThickness={0.4}
        cellColor="#00ff41"
        sectionSize={2}
        sectionThickness={0.8}
        sectionColor="#00ff41"
        fadeDistance={12}
        fadeStrength={1.5}
        position={[0, 0, 0]}
      />
      {/* Dark floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[FLOOR_SIZE.w, FLOOR_SIZE.d]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
      {/* Ceiling (subtle) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT, 0]}>
        <planeGeometry args={[FLOOR_SIZE.w, FLOOR_SIZE.d]} />
        <meshStandardMaterial color="#030303" transparent opacity={0.5} />
      </mesh>
    </>
  );
}

// Room labels
function RoomLabel({ text, position }: { text: string; position: [number, number, number] }) {
  return (
    <Html position={position} center style={{ pointerEvents: 'none' }}>
      <div className="font-mono text-[9px] text-hacker-green/40 uppercase tracking-widest">
        {text}
      </div>
    </Html>
  );
}

// ═══ BUBBLE COMPONENTS ═══

// Sleep bubble for idle agents — tiny "Zz" clickable, expands to full
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

// Speech bubble — tiny dot by default, expands to Habbo style on click
function SpeechBubble({
  name,
  color,
  thought,
  status,
  position,
}: {
  name: string;
  color: string;
  thought: string;
  status: string;
  position: [number, number, number];
}) {
  const [expanded, setExpanded] = useState(false);
  const displayText = status === 'discussing' ? '💬 ' + thought : thought;
  const icon = status === 'discussing' ? '⟩⟩' : '>_';

  return (
    <Html position={[position[0], position[1] + 2.2, position[2]]} center style={{ pointerEvents: 'auto' }}>
      {!expanded ? (
        /* Mini bubble — tiny Matrix-style pill */
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
        /* Expanded Habbo-style bubble */
        <div
          className="select-none"
          style={{ animation: 'bubbleExpand 0.25s ease-out forwards' }}
        >
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
            {/* Close button */}
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
                border: '1.5px solid #444',
                color: '#fff',
                fontSize: '8px',
                lineHeight: '12px',
                textAlign: 'center',
              }}
            >
              ✕
            </div>
            {/* Agent name */}
            <div className="font-mono text-[10px] font-bold" style={{ color, marginBottom: '2px' }}>
              {name}
            </div>
            {/* Thought text */}
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
            {/* Status dot */}
            <div className="flex items-center gap-1 mt-1">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
              />
              <span className="font-mono text-[8px] uppercase" style={{ color: '#666' }}>{status}</span>
            </div>
          </div>
          {/* Triangle pointer */}
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

// Floor ring at desk
function FloorRing({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={[position[0], 0.02, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.55, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.12} side={THREE.DoubleSide} />
    </mesh>
  );
}

// All agent positions for interaction system
const allDeskPositions = agentConfigs.map(c => c.position);

// Agent with desk, bubbles
function AgentStation({
  config, configIndex,
}: {
  config: typeof agentConfigs[0]; configIndex: number;
}) {
  // Bubble logic: idle → SleepBubble (desk), working → SpeechBubble (desk),
  // discussing → SpeechBubble (table position), roaming → no bubble
  const showSleepBubble = config.status === 'idle';
  const showSpeechBubble = config.status === 'working' || config.status === 'discussing';

  return (
    <>
      {/* 3D Model */}
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
      />

      {/* Desk */}
      <Desk position={config.position} color={config.color} />

      {/* Chair at desk */}
      <Chair position={[config.position[0] - 0.3, 0, config.position[2]]} color={config.color} />

      {/* Floor ring */}
      <FloorRing position={config.position} color={config.color} />

      {/* Bubbles based on status */}
      {showSleepBubble && (
        <SleepBubble position={config.position} name={config.name} color={config.color} />
      )}
      {showSpeechBubble && (
        <SpeechBubble
          name={config.name}
          color={config.color}
          thought={config.thought}
          status={config.status}
          position={config.status === 'discussing'
            ? meetingSeatPositions[configIndex % meetingSeatPositions.length]
            : config.position}
        />
      )}
    </>
  );
}

// Camera controller with reset support
function CameraControls({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={true}
      minDistance={10}
      maxDistance={30}
      maxPolarAngle={Math.PI / 3}
      minPolarAngle={Math.PI / 6}
      autoRotate={false}
      target={[0, 0, 0]}
    />
  );
}

// Reset camera to default position + mobile FOV adjustment
function CameraResetter({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  const { camera } = useThree();

  // On mobile, widen FOV slightly for more zoom-out
  const initialized = useRef(false);
  if (!initialized.current && typeof window !== 'undefined') {
    initialized.current = true;
    if (window.innerWidth < 640 && (camera as THREE.PerspectiveCamera).fov) {
      (camera as THREE.PerspectiveCamera).fov = 44;
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

export type AgentStatus = 'idle' | 'working' | 'discussing' | 'roaming';

export interface AgentLiveData {
  id: string;
  status: AgentStatus;
  thought: string;
}

export default function HQRoom3D({ liveAgents }: { liveAgents?: AgentLiveData[] }) {
  const controlsRef = useRef<any>(null);

  const handleResetCamera = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).__resetStageCamera) {
      (window as any).__resetStageCamera();
    }
  }, []);

  // Merge live data into agent configs
  const mergedConfigs = agentConfigs.map(config => {
    const live = liveAgents?.find(a => a.id === config.id);
    if (live) {
      return { ...config, status: live.status, thought: live.thought };
    }
    return config;
  });

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
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 12, 5]} intensity={1} color="#ffffff" />
        <directionalLight position={[-5, 8, -5]} intensity={0.4} color="#ffffff" />

        {/* Colored ambient */}
        <pointLight position={[-3.5, 3, 0]} intensity={0.3} color="#00d4ff" distance={8} />
        <pointLight position={[3.5, 3, 0]} intensity={0.3} color="#00ff41" distance={8} />

        {/* Hemisphere */}
        <hemisphereLight args={['#1a2a1a', '#0a0a0a', 0.5]} />

        {/* Fog */}
        <fog attach="fog" args={['#0a0a0a', 20, 40]} />

        <Suspense fallback={null}>
          {/* Room structure */}
          <RoomFloor />
          <RoomWalls />

          {/* Room labels */}
          <RoomLabel text="// office_space" position={[-3.2, 2.6, -4.5]} />
          <RoomLabel text="// meeting_room" position={[3.5, 2.6, -4.5]} />

          {/* Meeting table */}
          <MeetingTable position={MEETING_TABLE_POS} />

          {/* Agents */}
          {mergedConfigs.map((config, index) => (
            <AgentStation
              key={config.id}
              config={config}
              configIndex={index}
            />
          ))}
        </Suspense>

        <CameraControls controlsRef={controlsRef} />
        <CameraResetter controlsRef={controlsRef} />
      </Canvas>

      {/* Reset camera button — bottom right overlay */}
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
