'use client';

import { Suspense, useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

// ═══ WEBGL DETECTION ═══

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

// ═══ ROOM CONSTANTS ═══

const ROOM_W = 10;
const ROOM_D = 8;
const ROOM_H = 3.5;
const WALL_COLOR = '#080808';
const NEON_GREEN = '#00ff41';

// ═══ SHOWCASE MODEL ═══

function ShowcaseAgent({ modelPath, agentColor }: { modelPath: string; agentColor: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelPath);

  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const offset = -box.min.y;
    const cx = (box.max.x + box.min.x) / 2;
    const cz = (box.max.z + box.min.z) / 2;
    clone.position.set(-cx, offset, -cz);
    return clone;
  }, [scene]);

  const bobPhase = useRef(Math.random() * Math.PI * 2);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.x = Math.sin(t * 0.7 + bobPhase.current) * 0.015;
    groupRef.current.rotation.z = Math.sin(t * 1.1 + bobPhase.current) * 0.01;
    const breathe = 1.5 + Math.sin(t * 0.8 + bobPhase.current) * 0.008;
    groupRef.current.scale.set(breathe, breathe, breathe);
    groupRef.current.position.y = Math.sin(t * 0.6 + bobPhase.current) * 0.02;
  });

  return (
    <group ref={groupRef} scale={[1.5, 1.5, 1.5]}>
      <primitive object={clonedScene} />
      {/* Neon ring under agent */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.55, 48]} />
        <meshBasicMaterial color={agentColor} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color={agentColor} intensity={0.8} distance={4} position={[0, 2, 0]} />
    </group>
  );
}

// ═══ FLOOR PLATFORM ═══

function FloorPlatform({ agentColor }: { agentColor: string }) {
  return (
    <>
      {/* Central circular platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color="#0a0a0a" emissive={agentColor} emissiveIntensity={0.02} />
      </mesh>
      {/* Platform neon ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.1, 2.25, 48]} />
        <meshBasicMaterial color={agentColor} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Inner ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.4, 1.45, 48]} />
        <meshBasicMaterial color={agentColor} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

// ═══ ROOM ENVIRONMENT ═══

function RoomFloor() {
  return (
    <>
      {/* Dark floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color="#040404" />
      </mesh>
      {/* Matrix grid */}
      <Grid
        args={[ROOM_W, ROOM_D]}
        cellSize={0.5}
        cellThickness={0.3}
        cellColor={NEON_GREEN}
        sectionSize={2}
        sectionThickness={0.6}
        sectionColor={NEON_GREEN}
        fadeDistance={10}
        fadeStrength={2}
        position={[0, 0, 0]}
      />
    </>
  );
}

function RoomCeiling() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM_H, 0]}>
      <planeGeometry args={[ROOM_W, ROOM_D]} />
      <meshStandardMaterial color="#030303" transparent opacity={0.6} />
    </mesh>
  );
}

// Wall segment
function Wall({ start, end, height = ROOM_H }: { start: [number, number]; end: [number, number]; height?: number }) {
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
        emissive={NEON_GREEN}
        emissiveIntensity={0.015}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// Neon strip along wall top
function NeonStrip({ start, end, color = NEON_GREEN }: { start: [number, number]; end: [number, number]; color?: string }) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const cx = (start[0] + end[0]) / 2;
  const cz = (start[1] + end[1]) / 2;

  return (
    <group>
      <mesh position={[cx, ROOM_H + 0.01, cz]} rotation={[0, angle, 0]}>
        <boxGeometry args={[0.1, 0.03, length]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      {/* Floor-level neon strip */}
      <mesh position={[cx, 0.01, cz]} rotation={[0, angle, 0]}>
        <boxGeometry args={[0.06, 0.02, length]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </mesh>
      <pointLight position={[cx, ROOM_H + 0.05, cz]} color={color} intensity={0.15} distance={3} />
    </group>
  );
}

function RoomWalls({ agentColor }: { agentColor: string }) {
  const hw = ROOM_W / 2;
  const hd = ROOM_D / 2;

  const walls: [number, number][][] = [
    [[-hw, -hd], [hw, -hd]],  // front
    [[hw, -hd], [hw, hd]],    // right
    [[hw, hd], [-hw, hd]],    // back
    [[-hw, hd], [-hw, -hd]],  // left
  ];

  return (
    <group>
      {walls.map((wall, i) => (
        <group key={i}>
          <Wall start={wall[0]} end={wall[1]} />
          <NeonStrip start={wall[0]} end={wall[1]} color={i === 0 || i === 2 ? agentColor : NEON_GREEN} />
        </group>
      ))}
    </group>
  );
}

// ═══ ROOM DETAILS ═══

// Holographic data panels on walls
function HoloPanel({ position, rotation, color, width = 1.2 }: {
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  width?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.08 + Math.sin(state.clock.elapsedTime * 0.5) * 0.03;
  });

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[width, 1.4]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Vertical neon accent pillars at corners
function NeonPillar({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.06, ROOM_H, 0.06]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      <pointLight color={color} intensity={0.2} distance={2.5} position={[0, ROOM_H / 2, 0]} />
    </group>
  );
}

// Floating holographic ring that rotates
function HoloRing({ agentColor }: { agentColor: string }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    ringRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
  });

  return (
    <mesh ref={ringRef} position={[0, 2.8, 0]}>
      <torusGeometry args={[1.8, 0.015, 8, 64]} />
      <meshBasicMaterial color={agentColor} transparent opacity={0.2} />
    </mesh>
  );
}

// Ceiling light fixtures
function CeilingLights({ agentColor }: { agentColor: string }) {
  return (
    <>
      {/* Central spotlight */}
      <spotLight
        position={[0, ROOM_H - 0.1, 0]}
        angle={0.5}
        penumbra={0.8}
        intensity={0.6}
        color={agentColor}
        distance={5}
        target-position={[0, 0, 0]}
      />
      {/* Fixture mesh */}
      <mesh position={[0, ROOM_H - 0.05, 0]}>
        <cylinderGeometry args={[0.3, 0.2, 0.06, 16]} />
        <meshBasicMaterial color={agentColor} transparent opacity={0.3} />
      </mesh>
      {/* Side ceiling strips */}
      {[-2, 2].map((x) => (
        <group key={x}>
          <mesh position={[x, ROOM_H - 0.02, 0]}>
            <boxGeometry args={[0.04, 0.02, ROOM_D * 0.6]} />
            <meshBasicMaterial color={NEON_GREEN} transparent opacity={0.25} />
          </mesh>
          <pointLight position={[x, ROOM_H - 0.1, 0]} color={NEON_GREEN} intensity={0.1} distance={3} />
        </group>
      ))}
    </>
  );
}

function RoomEnvironment({ agentColor }: { agentColor: string }) {
  const hw = ROOM_W / 2;
  const hd = ROOM_D / 2;

  return (
    <>
      <RoomFloor />
      <RoomCeiling />
      <RoomWalls agentColor={agentColor} />

      {/* Corner pillars */}
      <NeonPillar position={[-hw + 0.05, ROOM_H / 2, -hd + 0.05]} color={NEON_GREEN} />
      <NeonPillar position={[hw - 0.05, ROOM_H / 2, -hd + 0.05]} color={NEON_GREEN} />
      <NeonPillar position={[-hw + 0.05, ROOM_H / 2, hd - 0.05]} color={agentColor} />
      <NeonPillar position={[hw - 0.05, ROOM_H / 2, hd - 0.05]} color={agentColor} />

      {/* Holo panels on back wall */}
      <HoloPanel position={[-2.5, 1.8, hd - 0.1]} rotation={[0, Math.PI, 0]} color={NEON_GREEN} />
      <HoloPanel position={[2.5, 1.8, hd - 0.1]} rotation={[0, Math.PI, 0]} color={agentColor} />

      {/* Holo panels on side walls */}
      <HoloPanel position={[-hw + 0.1, 1.8, -1.5]} rotation={[0, Math.PI / 2, 0]} color={agentColor} width={1} />
      <HoloPanel position={[hw - 0.1, 1.8, 1.5]} rotation={[0, -Math.PI / 2, 0]} color={NEON_GREEN} width={1} />

      {/* Floating holo ring above agent */}
      <HoloRing agentColor={agentColor} />

      {/* Ceiling lights */}
      <CeilingLights agentColor={agentColor} />
    </>
  );
}

// ═══ FALLBACKS ═══

function LoadingSpinner() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-hacker-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-hacker-green font-mono text-[10px]">// chargement_modèle...</p>
      </div>
    </div>
  );
}

function NoWebGLFallback({ agentName }: { agentName: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#060606]">
      <div className="text-center font-mono px-4">
        <div className="text-hacker-amber text-sm mb-2">// webgl_indisponible</div>
        <div className="text-hacker-muted text-xs">
          Le rendu 3D nécessite un navigateur avec WebGL activé.
        </div>
        <div className="text-hacker-green/40 text-[10px] mt-3 uppercase tracking-widest">
          // {agentName.toLowerCase()}_3d_model
        </div>
      </div>
    </div>
  );
}

// ═══ CAMERA DEFAULTS ═══

const DEFAULT_CAM_POS: [number, number, number] = [5, 4, 8];
const DEFAULT_CAM_FOV = 45;
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 1, 0);

// Camera reset helper — stores reset fn on window
function CameraResetter({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  const { camera } = useThree();

  const resetCamera = useCallback(() => {
    camera.position.set(...DEFAULT_CAM_POS);
    if (controlsRef.current) {
      controlsRef.current.target.copy(DEFAULT_CAM_TARGET);
      controlsRef.current.update();
    }
  }, [camera, controlsRef]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__resetShowcaseCamera = resetCamera;
    }
  }, [resetCamera]);

  return null;
}

// ═══ EXPORTED COMPONENT ═══

interface AgentShowcase3DProps {
  modelPath: string;
  agentColor: string;
  agentName: string;
}

export default function AgentShowcase3D({ modelPath, agentColor, agentName }: AgentShowcase3DProps) {
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    setWebglSupported(detectWebGL());
  }, []);

  const handleResetCamera = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).__resetShowcaseCamera) {
      (window as any).__resetShowcaseCamera();
    }
  }, []);

  if (webglSupported === null) {
    return <LoadingSpinner />;
  }

  if (!webglSupported) {
    return <NoWebGLFallback agentName={agentName} />;
  }

  return (
    <div className="w-full h-full relative">
      <Suspense fallback={<LoadingSpinner />}>
        <Canvas
          camera={{ position: DEFAULT_CAM_POS, fov: DEFAULT_CAM_FOV }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
          onCreated={(state) => {
            state.gl.setClearColor('#040404', 1);
          }}
        >
          {/* Global lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 8, 5]} intensity={0.8} color="#ffffff" />
          <directionalLight position={[-3, 5, -3]} intensity={0.3} color="#ffffff" />
          <pointLight color={agentColor} intensity={1.2} distance={8} position={[0, 3, 2]} />
          <hemisphereLight args={['#1a2a1a', '#0a0a0a', 0.4]} />

          <fog attach="fog" args={['#040404', 15, 30]} />

          <Suspense fallback={null}>
            {/* Room environment */}
            <RoomEnvironment agentColor={agentColor} />

            {/* Agent platform + model */}
            <FloorPlatform agentColor={agentColor} />
            <ShowcaseAgent modelPath={modelPath} agentColor={agentColor} />
          </Suspense>

          <OrbitControls
            ref={controlsRef}
            autoRotate
            autoRotateSpeed={0.3}
            enablePan={false}
            enableZoom={true}
            minDistance={6}
            maxDistance={16}
            maxPolarAngle={Math.PI / 2.3}
            minPolarAngle={Math.PI / 6}
            target={[0, 1, 0]}
          />
          <CameraResetter controlsRef={controlsRef} />
        </Canvas>
      </Suspense>

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

      <div className="absolute bottom-3 left-3 font-mono text-[10px] text-hacker-green/50 uppercase tracking-widest pointer-events-none">
        // {agentName.toLowerCase()}_3d_model
      </div>
    </div>
  );
}
