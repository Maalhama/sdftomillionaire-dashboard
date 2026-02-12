'use client';

import { Suspense, useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
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
      <pointLight color={agentColor} intensity={0.8} distance={3} position={[0, 2, 0]} />
    </group>
  );
}

// ═══ FLOOR PLATFORM ═══

function FloorPlatform({ agentColor }: { agentColor: string }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[2, 48]} />
        <meshStandardMaterial color="#080808" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[1.9, 2, 48]} />
        <meshBasicMaterial color={agentColor} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
      <Grid
        args={[4, 4]}
        cellSize={0.25}
        cellThickness={0.3}
        cellColor="#00ff41"
        sectionSize={1}
        sectionThickness={0.6}
        sectionColor="#00ff41"
        fadeDistance={6}
        fadeStrength={2}
        position={[0, -0.03, 0]}
      />
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

// ═══ EXPORTED COMPONENT ═══

interface AgentShowcase3DProps {
  modelPath: string;
  agentColor: string;
  agentName: string;
}

export default function AgentShowcase3D({ modelPath, agentColor, agentName }: AgentShowcase3DProps) {
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglSupported(detectWebGL());
  }, []);

  // Still detecting
  if (webglSupported === null) {
    return <LoadingSpinner />;
  }

  // No WebGL — graceful fallback, no error thrown
  if (!webglSupported) {
    return <NoWebGLFallback agentName={agentName} />;
  }

  return (
    <div className="w-full h-full relative">
      <Suspense fallback={<LoadingSpinner />}>
        <Canvas
          camera={{ position: [0, 4, 10], fov: 40 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
          onCreated={(state) => {
            state.gl.setClearColor('#060606', 1);
          }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 8, 5]} intensity={1} color="#ffffff" />
          <pointLight color={agentColor} intensity={0.6} distance={6} position={[0, 3, 2]} />
          <hemisphereLight args={['#1a2a1a', '#0a0a0a', 0.4]} />

          <fog attach="fog" args={['#0a0a0a', 8, 15]} />

          <Suspense fallback={null}>
            <FloorPlatform agentColor={agentColor} />
            <ShowcaseAgent modelPath={modelPath} agentColor={agentColor} />
          </Suspense>

          <OrbitControls
            autoRotate
            autoRotateSpeed={0.4}
            enablePan={false}
            enableZoom={false}
            maxPolarAngle={Math.PI / 2.2}
            minPolarAngle={Math.PI / 5}
            target={[0, 0.8, 0]}
          />
        </Canvas>
      </Suspense>

      <div className="absolute bottom-3 left-3 font-mono text-[10px] text-hacker-green/50 uppercase tracking-widest pointer-events-none">
        // {agentName.toLowerCase()}_3d_model
      </div>
    </div>
  );
}
