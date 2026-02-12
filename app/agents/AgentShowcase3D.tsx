'use client';

import { Suspense, useRef, useMemo, useState, useCallback, useEffect, Component, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, useGLTF } from '@react-three/drei';
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

// ═══ MATRIX DIGITAL RAIN (columns of falling digits) ═══

const MATRIX_CHARS = '0123456789';
const COLUMN_COUNT = 24;
const CHARS_PER_COLUMN = 28;
const CHAR_SIZE = 0.35;

function MatrixDigitalRain() {
  const meshRef = useRef<THREE.Mesh>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const columnsRef = useRef<{ offset: number; speed: number; chars: string[] }[]>([]);

  const { canvas, texture } = useMemo(() => {
    const W = 512;
    const H = 1024;
    const cvs = document.createElement('canvas');
    cvs.width = W;
    cvs.height = H;
    const ctx = cvs.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    const tex = new THREE.CanvasTexture(cvs);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    // Init columns
    const cols: { offset: number; speed: number; chars: string[] }[] = [];
    for (let c = 0; c < COLUMN_COUNT; c++) {
      const chars: string[] = [];
      for (let r = 0; r < CHARS_PER_COLUMN; r++) {
        chars.push(MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]);
      }
      cols.push({
        offset: Math.random() * CHARS_PER_COLUMN,
        speed: 0.8 + Math.random() * 1.5,
        chars,
      });
    }
    columnsRef.current = cols;
    canvasRef.current = cvs;
    textureRef.current = tex;

    return { canvas: cvs, texture: tex };
  }, []);

  useFrame((state) => {
    if (!canvasRef.current || !textureRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    const W = canvasRef.current.width;
    const H = canvasRef.current.height;
    const dt = 0.016;

    // Fade background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(0, 0, W, H);

    const colWidth = W / COLUMN_COUNT;
    const rowHeight = H / CHARS_PER_COLUMN;
    ctx.font = `bold ${Math.floor(rowHeight * 0.75)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let c = 0; c < COLUMN_COUNT; c++) {
      const col = columnsRef.current[c];
      col.offset += col.speed * dt;

      // Randomly change a character
      if (Math.random() < 0.08) {
        const ri = Math.floor(Math.random() * CHARS_PER_COLUMN);
        col.chars[ri] = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
      }

      const headRow = Math.floor(col.offset) % CHARS_PER_COLUMN;
      const x = colWidth * c + colWidth / 2;

      for (let r = 0; r < CHARS_PER_COLUMN; r++) {
        const y = rowHeight * r + rowHeight / 2;
        const dist = (headRow - r + CHARS_PER_COLUMN) % CHARS_PER_COLUMN;

        if (dist === 0) {
          // Head character — bright white-green
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 1;
        } else if (dist < 6) {
          // Trail — bright green fading
          ctx.fillStyle = NEON_GREEN;
          ctx.globalAlpha = 1 - dist * 0.12;
        } else if (dist < 16) {
          // Mid trail — darker green
          ctx.fillStyle = '#00aa30';
          ctx.globalAlpha = 0.5 - (dist - 6) * 0.04;
        } else {
          continue; // Skip far chars (already faded by background)
        }

        ctx.fillText(col.chars[r], x, y);
      }
    }
    ctx.globalAlpha = 1;

    textureRef.current.needsUpdate = true;
  });

  return (
    <mesh ref={meshRef} position={[0, 5, -8]} rotation={[0, 0, 0]}>
      <planeGeometry args={[18, 12]} />
      <meshBasicMaterial map={texture} transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
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

const DEFAULT_CAM_POS: [number, number, number] = [5.5, 4.5, 9];
const DEFAULT_CAM_FOV = 48;
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 1, 0);

// Oscillate camera left/right, always facing the front of the character
function CameraOscillator() {
  const { camera } = useThree();
  const initialized = useRef(false);
  const baseDistance = Math.sqrt(DEFAULT_CAM_POS[0] ** 2 + DEFAULT_CAM_POS[2] ** 2);
  const baseY = DEFAULT_CAM_POS[1];
  const swingAngle = 0.35; // ~20° each side

  if (!initialized.current && typeof window !== 'undefined') {
    initialized.current = true;
    if (window.innerWidth < 768 && (camera as THREE.PerspectiveCamera).fov) {
      (camera as THREE.PerspectiveCamera).fov = 56;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const angle = Math.sin(t * 0.25) * swingAngle; // slow oscillation
    camera.position.x = Math.sin(angle) * baseDistance;
    camera.position.z = Math.cos(angle) * baseDistance;
    camera.position.y = baseY + Math.sin(t * 0.4) * 0.15; // subtle vertical bob
    camera.lookAt(DEFAULT_CAM_TARGET);
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__resetShowcaseCamera = () => {
        camera.position.set(...DEFAULT_CAM_POS);
        camera.lookAt(DEFAULT_CAM_TARGET);
      };
    }
  }, [camera]);

  return null;
}

// ═══ EXPORTED COMPONENT ═══

interface AgentShowcase3DProps {
  modelPath: string;
  agentColor: string;
  agentName: string;
}

export default function AgentShowcase3D({ modelPath, agentColor, agentName }: AgentShowcase3DProps) {
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
            <MatrixDigitalRain />
            <FloorPlatform agentColor={agentColor} />
            <ShowcaseAgent modelPath={modelPath} agentColor={agentColor} />
          </Suspense>

          <CameraOscillator />
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
