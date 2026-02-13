'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

// Preload all models so they start downloading immediately
['/models/minion.glb', '/models/sage.glb', '/models/scout.glb', '/models/quill.glb', '/models/xalt.glb', '/models/observer.glb'].forEach((p) => useGLTF.preload(p));

type AgentState = 'idle' | 'working' | 'walking-to-meeting' | 'meeting' | 'returning';

interface AgentModelProps {
  modelPath: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  status: 'active' | 'working' | 'idle' | 'sync';
  color: string;
  allAgentPositions?: [number, number, number][];
  meetingPositions?: [number, number, number][];
  agentIndex?: number;
  onClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
}

export default function AgentModel({
  modelPath,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  status,
  color,
  allAgentPositions = [],
  meetingPositions = [],
  agentIndex = 0,
  onClick,
  onPointerOver,
  onPointerOut,
}: AgentModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelPath);

  const behaviorRef = useRef({
    state: (status === 'idle' ? 'idle' : status === 'sync' ? 'walking-to-meeting' : 'working') as AgentState,
    stateTimer: 0,
    stateDuration: status === 'sync' ? 2.5 : 999,
    currentPos: new THREE.Vector3(position[0], position[1], position[2]),
    startPos: new THREE.Vector3(position[0], position[1], position[2]),
    targetPos: new THREE.Vector3(position[0], position[1], position[2]),
    homePos: new THREE.Vector3(position[0], position[1], position[2]),
    meetingSeat: new THREE.Vector3(0, 0, 0),
    bobPhase: Math.random() * Math.PI * 2,
    currentRotY: rotation[1] * Math.PI / 180,
    targetRotY: rotation[1] * Math.PI / 180,
    prevStatus: status,
    meetingCycleDone: false,
  });

  // React to status prop changes
  const b = behaviorRef.current;
  if (status !== b.prevStatus) {
    b.prevStatus = status;
    b.meetingCycleDone = false;

    if (status === 'idle') {
      b.state = 'idle';
      b.stateTimer = 0;
      b.stateDuration = 999;
    } else if (status === 'sync' && meetingPositions.length > 0) {
      const seatIdx = agentIndex % meetingPositions.length;
      const seat = meetingPositions[seatIdx];
      b.meetingSeat.set(seat[0], 0, seat[2]);
      b.startPos.copy(b.homePos);
      b.targetPos.copy(b.meetingSeat);
      b.state = 'walking-to-meeting';
      b.stateTimer = 0;
      b.stateDuration = 2.5;
    } else {
      b.state = 'working';
      b.stateTimer = 0;
      b.stateDuration = 999;
    }
  }

  const { clonedScene, yOffset } = useMemo(() => {
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const offset = -box.min.y;
    return { clonedScene: clone, yOffset: offset };
  }, [scene]);

  // Initialize sync agents on first render
  const initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    if (status === 'sync' && meetingPositions.length > 0) {
      const seatIdx = agentIndex % meetingPositions.length;
      const seat = meetingPositions[seatIdx];
      b.meetingSeat.set(seat[0], 0, seat[2]);
      b.startPos.copy(b.homePos);
      b.targetPos.copy(b.meetingSeat);
      b.state = 'walking-to-meeting';
      b.stateTimer = 0;
      b.stateDuration = 2.5;
    }
  }

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const b = behaviorRef.current;

    b.stateTimer += delta;

    // State transitions for meeting cycle only (sync status)
    if (b.stateTimer >= b.stateDuration) {
      switch (b.state) {
        case 'walking-to-meeting':
          b.currentPos.copy(b.meetingSeat);
          b.state = 'meeting';
          b.stateTimer = 0;
          b.stateDuration = 5;
          break;

        case 'meeting':
          b.startPos.copy(b.currentPos);
          b.targetPos.copy(b.homePos);
          b.state = 'returning';
          b.stateTimer = 0;
          b.stateDuration = 2.5;
          break;

        case 'returning':
          b.currentPos.copy(b.homePos);
          b.meetingCycleDone = true;
          // Return to working after meeting cycle
          b.state = 'working';
          b.stateTimer = 0;
          b.stateDuration = 999;
          break;

        // idle and working don't transition on timer
        default:
          break;
      }
    }

    const progress = Math.min(b.stateTimer / b.stateDuration, 1);
    const ease = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    // Smooth rotation
    b.currentRotY = THREE.MathUtils.lerp(b.currentRotY, b.targetRotY, 0.05);

    switch (b.state) {
      case 'idle': {
        // At desk — minimal breathing only, no sway
        groupRef.current.position.x = b.homePos.x;
        groupRef.current.position.z = b.homePos.z;
        groupRef.current.position.y = Math.sin(t * 0.6 + b.bobPhase) * 0.003;

        groupRef.current.rotation.x = 0;
        b.targetRotY = rotation[1] * Math.PI / 180;
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.z = 0;

        // Minimal breathing
        const idleBreathe = 1 + Math.sin(t * 0.6 + b.bobPhase) * 0.002;
        groupRef.current.scale.set(scale * idleBreathe, scale * idleBreathe, scale * idleBreathe);
        break;
      }

      case 'working': {
        // At desk — subtle working animations
        groupRef.current.position.x = b.homePos.x;
        groupRef.current.position.z = b.homePos.z;
        groupRef.current.position.y = Math.sin(t * 1.2 + b.bobPhase) * 0.008;

        // Working sway
        groupRef.current.rotation.x = Math.sin(t * 0.8 + b.bobPhase) * 0.02;
        b.targetRotY = rotation[1] * Math.PI / 180;
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.z = Math.sin(t * 1.5 + b.bobPhase) * 0.01;

        // Breathing scale
        const breathe = 1 + Math.sin(t * 1.2 + b.bobPhase) * 0.005;
        groupRef.current.scale.set(scale * breathe, scale * breathe, scale * breathe);
        break;
      }

      case 'walking-to-meeting':
      case 'returning': {
        // Walking between desk and meeting room
        groupRef.current.position.x = THREE.MathUtils.lerp(b.startPos.x, b.targetPos.x, ease);
        groupRef.current.position.z = THREE.MathUtils.lerp(b.startPos.z, b.targetPos.z, ease);
        // Walking bob
        groupRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.035;
        // Face direction
        const dx = b.targetPos.x - b.startPos.x;
        const dz = b.targetPos.z - b.startPos.z;
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
          b.targetRotY = Math.atan2(dx, dz);
        }
        groupRef.current.rotation.y = b.currentRotY;
        // Walking tilt
        groupRef.current.rotation.z = Math.sin(t * 6) * 0.03;
        groupRef.current.rotation.x = 0;
        groupRef.current.scale.set(scale, scale, scale);

        // Update current position
        b.currentPos.set(groupRef.current.position.x, 0, groupRef.current.position.z);
        break;
      }

      case 'meeting': {
        // At meeting table — face center of table (3.5, 0, 0)
        groupRef.current.position.x = b.meetingSeat.x;
        groupRef.current.position.z = b.meetingSeat.z;
        groupRef.current.position.y = Math.sin(t * 1.5 + b.bobPhase) * 0.01;

        // Face the center of the meeting table
        const toDx = 3.5 - b.meetingSeat.x;
        const toDz = 0 - b.meetingSeat.z;
        b.targetRotY = Math.atan2(toDx, toDz);
        groupRef.current.rotation.y = b.currentRotY;

        // Talking nod
        groupRef.current.rotation.x = Math.sin(t * 2.5 + b.bobPhase) * 0.04;
        groupRef.current.rotation.z = Math.sin(t * 1.8 + b.bobPhase) * 0.02;
        groupRef.current.scale.set(scale, scale, scale);
        break;
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation.map(r => r * Math.PI / 180) as unknown as THREE.Euler}
      scale={[scale, scale, scale]}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <primitive object={clonedScene} position={[0, yOffset, 0]} />

      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.5, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={status === 'idle' ? 0.15 : 0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight
        color={color}
        intensity={status === 'idle' ? 0.2 : 0.6}
        distance={2.5}
        position={[0, 1.5, 0]}
      />
    </group>
  );
}
