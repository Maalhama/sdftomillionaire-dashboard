'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { AgentStatus } from './HQRoom3D';

useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

// Preload all models so they start downloading immediately
['/models/minion.glb', '/models/sage.glb', '/models/scout.glb', '/models/quill.glb', '/models/xalt.glb', '/models/observer.glb'].forEach((p) => useGLTF.preload(p));

type InternalState =
  | 'idle'
  | 'working'
  | 'walking-to-meeting'
  | 'meeting'
  | 'walking-to-waypoint'
  | 'pausing-at-waypoint'
  | 'returning-to-desk';

// Fisher-Yates shuffle (deterministic per call)
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface AgentModelProps {
  modelPath: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  status: AgentStatus;
  color: string;
  allAgentPositions?: [number, number, number][];
  meetingPositions?: [number, number, number][];
  roamWaypoints?: [number, number, number][];
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
  meetingPositions = [],
  roamWaypoints = [],
  agentIndex = 0,
}: AgentModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelPath);

  // Walk speed varies per agent (1.5 to 2.0, seeded by agentIndex)
  const walkSpeed = useMemo(() => 1.5 + (agentIndex * 0.1) % 0.5, [agentIndex]);

  const behaviorRef = useRef({
    internalState: 'idle' as InternalState,
    stateTimer: 0,
    stateDuration: 999,
    currentPos: new THREE.Vector3(position[0], position[1], position[2]),
    startPos: new THREE.Vector3(position[0], position[1], position[2]),
    targetPos: new THREE.Vector3(position[0], position[1], position[2]),
    homePos: new THREE.Vector3(position[0], position[1], position[2]),
    meetingSeat: new THREE.Vector3(0, 0, 0),
    bobPhase: Math.random() * Math.PI * 2,
    currentRotY: rotation[1] * Math.PI / 180,
    targetRotY: rotation[1] * Math.PI / 180,
    prevStatus: status,
    // Roaming state
    shuffledWaypoints: shuffleArray(roamWaypoints),
    waypointIndex: 0,
    pauseDuration: 2 + Math.random() * 3, // 2-5s pause at waypoints
  });

  const b = behaviorRef.current;

  // Compute walk duration based on distance
  const computeWalkDuration = (from: THREE.Vector3, to: THREE.Vector3) => {
    const dist = from.distanceTo(to);
    return Math.max(0.5, dist / walkSpeed);
  };

  // Start walking to a specific target
  const startWalkTo = (target: THREE.Vector3, nextState: InternalState) => {
    b.startPos.copy(b.currentPos);
    b.targetPos.copy(target);
    b.stateTimer = 0;
    b.stateDuration = computeWalkDuration(b.currentPos, target);
    b.internalState = nextState;
  };

  // Pick next roam waypoint
  const pickNextWaypoint = () => {
    if (b.shuffledWaypoints.length === 0) return;
    if (b.waypointIndex >= b.shuffledWaypoints.length) {
      b.shuffledWaypoints = shuffleArray(roamWaypoints);
      b.waypointIndex = 0;
    }
    const wp = b.shuffledWaypoints[b.waypointIndex];
    b.waypointIndex++;
    const target = new THREE.Vector3(wp[0], 0, wp[2]);
    startWalkTo(target, 'walking-to-waypoint');
  };

  // React to status prop changes
  if (status !== b.prevStatus) {
    b.prevStatus = status;

    switch (status) {
      case 'discussing': {
        if (meetingPositions.length > 0) {
          const seatIdx = agentIndex % meetingPositions.length;
          const seat = meetingPositions[seatIdx];
          b.meetingSeat.set(seat[0], 0, seat[2]);
          startWalkTo(b.meetingSeat, 'walking-to-meeting');
        }
        break;
      }
      case 'roaming': {
        if (roamWaypoints.length > 0) {
          b.shuffledWaypoints = shuffleArray(roamWaypoints);
          b.waypointIndex = 0;
          pickNextWaypoint();
        }
        break;
      }
      case 'idle': {
        // If not at desk, walk back; otherwise go idle directly
        const distToHome = b.currentPos.distanceTo(b.homePos);
        if (distToHome > 0.3) {
          startWalkTo(b.homePos, 'returning-to-desk');
        } else {
          b.internalState = 'idle';
          b.stateTimer = 0;
          b.stateDuration = 999;
        }
        break;
      }
      case 'working': {
        const distToHome2 = b.currentPos.distanceTo(b.homePos);
        if (distToHome2 > 0.3) {
          startWalkTo(b.homePos, 'returning-to-desk');
        } else {
          b.internalState = 'working';
          b.stateTimer = 0;
          b.stateDuration = 999;
        }
        break;
      }
    }
  }

  const { clonedScene, yOffset } = useMemo(() => {
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const offset = -box.min.y;
    return { clonedScene: clone, yOffset: offset };
  }, [scene]);

  // Initialize on first render
  const initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    if (status === 'discussing' && meetingPositions.length > 0) {
      const seatIdx = agentIndex % meetingPositions.length;
      const seat = meetingPositions[seatIdx];
      b.meetingSeat.set(seat[0], 0, seat[2]);
      startWalkTo(b.meetingSeat, 'walking-to-meeting');
    } else if (status === 'roaming' && roamWaypoints.length > 0) {
      b.shuffledWaypoints = shuffleArray(roamWaypoints);
      b.waypointIndex = 0;
      pickNextWaypoint();
    } else if (status === 'working') {
      b.internalState = 'working';
    }
  }

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const b = behaviorRef.current;

    b.stateTimer += delta;

    // State transitions when timer expires
    if (b.stateTimer >= b.stateDuration) {
      switch (b.internalState) {
        case 'walking-to-meeting': {
          b.currentPos.copy(b.meetingSeat);
          b.internalState = 'meeting';
          b.stateTimer = 0;
          b.stateDuration = 999; // stay until status changes
          break;
        }
        case 'walking-to-waypoint': {
          b.currentPos.copy(b.targetPos);
          b.internalState = 'pausing-at-waypoint';
          b.stateTimer = 0;
          b.pauseDuration = 2 + Math.random() * 3;
          b.stateDuration = b.pauseDuration;
          break;
        }
        case 'pausing-at-waypoint': {
          // If still roaming, pick next waypoint
          if (status === 'roaming' && roamWaypoints.length > 0) {
            pickNextWaypoint();
          } else {
            // Status changed while pausing, go back to desk
            startWalkTo(b.homePos, 'returning-to-desk');
          }
          break;
        }
        case 'returning-to-desk': {
          b.currentPos.copy(b.homePos);
          b.internalState = status === 'working' ? 'working' : 'idle';
          b.stateTimer = 0;
          b.stateDuration = 999;
          break;
        }
        // idle, working, meeting don't auto-transition
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

    switch (b.internalState) {
      case 'idle': {
        groupRef.current.position.x = b.homePos.x;
        groupRef.current.position.z = b.homePos.z;
        groupRef.current.position.y = Math.sin(t * 0.6 + b.bobPhase) * 0.003;
        groupRef.current.rotation.x = 0;
        b.targetRotY = rotation[1] * Math.PI / 180;
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.z = 0;
        const idleBreathe = 1 + Math.sin(t * 0.6 + b.bobPhase) * 0.002;
        groupRef.current.scale.set(scale * idleBreathe, scale * idleBreathe, scale * idleBreathe);
        break;
      }

      case 'working': {
        groupRef.current.position.x = b.homePos.x;
        groupRef.current.position.z = b.homePos.z;
        groupRef.current.position.y = Math.sin(t * 1.2 + b.bobPhase) * 0.008;
        groupRef.current.rotation.x = Math.sin(t * 0.8 + b.bobPhase) * 0.02;
        b.targetRotY = rotation[1] * Math.PI / 180;
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.z = Math.sin(t * 1.5 + b.bobPhase) * 0.01;
        const breathe = 1 + Math.sin(t * 1.2 + b.bobPhase) * 0.005;
        groupRef.current.scale.set(scale * breathe, scale * breathe, scale * breathe);
        break;
      }

      case 'walking-to-meeting':
      case 'walking-to-waypoint':
      case 'returning-to-desk': {
        groupRef.current.position.x = THREE.MathUtils.lerp(b.startPos.x, b.targetPos.x, ease);
        groupRef.current.position.z = THREE.MathUtils.lerp(b.startPos.z, b.targetPos.z, ease);
        groupRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.035;
        const dx = b.targetPos.x - b.startPos.x;
        const dz = b.targetPos.z - b.startPos.z;
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
          b.targetRotY = Math.atan2(dx, dz);
        }
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.z = Math.sin(t * 6) * 0.03;
        groupRef.current.rotation.x = 0;
        groupRef.current.scale.set(scale, scale, scale);
        b.currentPos.set(groupRef.current.position.x, 0, groupRef.current.position.z);
        break;
      }

      case 'meeting': {
        groupRef.current.position.x = b.meetingSeat.x;
        groupRef.current.position.z = b.meetingSeat.z;
        groupRef.current.position.y = Math.sin(t * 1.5 + b.bobPhase) * 0.01;
        const toDx = 3.5 - b.meetingSeat.x;
        const toDz = 0 - b.meetingSeat.z;
        b.targetRotY = Math.atan2(toDx, toDz);
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.x = Math.sin(t * 2.5 + b.bobPhase) * 0.04;
        groupRef.current.rotation.z = Math.sin(t * 1.8 + b.bobPhase) * 0.02;
        groupRef.current.scale.set(scale, scale, scale);
        break;
      }

      case 'pausing-at-waypoint': {
        // Stand still at waypoint, look around subtly
        groupRef.current.position.x = b.currentPos.x;
        groupRef.current.position.z = b.currentPos.z;
        groupRef.current.position.y = Math.sin(t * 0.8 + b.bobPhase) * 0.005;
        // Slow look-around rotation
        b.targetRotY += Math.sin(t * 0.5 + b.bobPhase) * 0.002;
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.x = 0;
        groupRef.current.rotation.z = 0;
        const pauseBreathe = 1 + Math.sin(t * 0.9 + b.bobPhase) * 0.003;
        groupRef.current.scale.set(scale * pauseBreathe, scale * pauseBreathe, scale * pauseBreathe);
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
