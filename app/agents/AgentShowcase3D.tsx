'use client';

import { Suspense, useRef, useMemo, useState, useCallback, useEffect, Component, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

// ═══ ERROR BOUNDARY ═══

class Showcase3DErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ═══ CONSTANTS ═══

const NEON_GREEN = '#00ff41';
const GRID_SIZE = 20;
const PARTICLE_COUNT = 300;

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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color="#0a0a0a" emissive={agentColor} emissiveIntensity={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.1, 2.25, 48]} />
        <meshBasicMaterial color={agentColor} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.4, 1.45, 48]} />
        <meshBasicMaterial color={agentColor} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

// ═══ MATRIX GRID FLOOR ═══

function MatrixFloor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshStandardMaterial color="#020202" />
      </mesh>
      <Grid
        args={[GRID_SIZE, GRID_SIZE]}
        cellSize={0.5}
        cellThickness={0.3}
        cellColor={NEON_GREEN}
        sectionSize={2}
        sectionThickness={0.6}
        sectionColor={NEON_GREEN}
        fadeDistance={14}
        fadeStrength={2}
        position={[0, 0, 0]}
      />
    </>
  );
}

// ═══ MATRIX RAIN PARTICLES ═══

function MatrixRain() {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, speeds, phases } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const spd = new Float32Array(PARTICLE_COUNT);
    const phs = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Spread particles in a wide area around center
      pos[i3] = (Math.random() - 0.5) * GRID_SIZE;       // x
      pos[i3 + 1] = Math.random() * 12;                   // y (0 to 12 height)
      pos[i3 + 2] = (Math.random() - 0.5) * GRID_SIZE;   // z
      spd[i] = 1.5 + Math.random() * 3;                   // fall speed
      phs[i] = Math.random() * Math.PI * 2;               // phase for brightness flicker
    }

    return { positions: pos, speeds: spd, phases: phs };
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Fall down
      posArray[i3 + 1] -= speeds[i] * 0.016; // ~60fps delta

      // Reset to top when hitting ground
      if (posArray[i3 + 1] < 0) {
        posArray[i3] = (Math.random() - 0.5) * GRID_SIZE;
        posArray[i3 + 1] = 8 + Math.random() * 4;
        posArray[i3 + 2] = (Math.random() - 0.5) * GRID_SIZE;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;

    // Subtle flicker on the material
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = 0.5 + Math.sin(t * 2) * 0.1;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={NEON_GREEN}
        size={0.06}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// Taller vertical "streams" — thin green lines falling like Matrix code columns
function MatrixStreams() {
  const STREAM_COUNT = 40;
  const groupRef = useRef<THREE.Group>(null);

  const streams = useMemo(() => {
    return Array.from({ length: STREAM_COUNT }, () => ({
      x: (Math.random() - 0.5) * GRID_SIZE,
      z: (Math.random() - 0.5) * GRID_SIZE,
      y: Math.random() * 10,
      speed: 2 + Math.random() * 4,
      height: 0.3 + Math.random() * 1.5,
      opacity: 0.1 + Math.random() * 0.25,
    }));
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const s = streams[i];
      child.position.y -= s.speed * 0.016;
      if (child.position.y < -s.height) {
        child.position.y = 8 + Math.random() * 4;
        child.position.x = (Math.random() - 0.5) * GRID_SIZE;
        child.position.z = (Math.random() - 0.5) * GRID_SIZE;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {streams.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]}>
          <boxGeometry args={[0.02, s.height, 0.02]} />
          <meshBasicMaterial color={NEON_GREEN} transparent opacity={s.opacity} />
        </mesh>
      ))}
    </group>
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

const DEFAULT_CAM_POS: [number, number, number] = [7, 5.5, 11];
const DEFAULT_CAM_FOV = 50;
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 1, 0);

function CameraResetter({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  const { camera } = useThree();
  const initialized = useRef(false);

  if (!initialized.current && typeof window !== 'undefined') {
    initialized.current = true;
    if (window.innerWidth < 768 && (camera as THREE.PerspectiveCamera).fov) {
      (camera as THREE.PerspectiveCamera).fov = 58;
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
  const controlsRef = useRef<any>(null);
  const [error, setError] = useState(false);

  const handleResetCamera = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).__resetShowcaseCamera) {
      (window as any).__resetShowcaseCamera();
    }
  }, []);

  if (error) {
    return <NoWebGLFallback agentName={agentName} />;
  }

  return (
    <Showcase3DErrorBoundary fallback={<NoWebGLFallback agentName={agentName} />}>
    <div className="w-full h-full relative">
      <Suspense fallback={<LoadingSpinner />}>
        <Canvas
          camera={{ position: DEFAULT_CAM_POS, fov: DEFAULT_CAM_FOV }}
          gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false }}
          style={{ background: 'transparent' }}
          onCreated={(state) => {
            state.gl.setClearColor('#020202', 1);
          }}
          onError={() => setError(true)}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 8, 5]} intensity={0.8} color="#ffffff" />
          <directionalLight position={[-3, 5, -3]} intensity={0.3} color="#ffffff" />
          <pointLight color={agentColor} intensity={1.2} distance={8} position={[0, 3, 2]} />
          <hemisphereLight args={['#1a2a1a', '#0a0a0a', 0.4]} />

          <fog attach="fog" args={['#020202', 14, 28]} />

          <Suspense fallback={null}>
            <MatrixFloor />
            <MatrixRain />
            <MatrixStreams />
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
            maxDistance={20}
            maxPolarAngle={Math.PI / 2.3}
            minPolarAngle={Math.PI / 6}
            target={[0, 1, 0]}
          />
          <CameraResetter controlsRef={controlsRef} />
        </Canvas>
      </Suspense>

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
    </Showcase3DErrorBoundary>
  );
}
