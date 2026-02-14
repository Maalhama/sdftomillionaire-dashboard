'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { AgentStatus, CollisionData } from './HQRoom3D';

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

// Fisher-Yates shuffle
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
  collisionData?: CollisionData;
  sharedPositions?: Float32Array;
  totalAgents?: number;
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
  collisionData,
  sharedPositions,
  totalAgents = 6,
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
    pauseDuration: 2 + Math.random() * 3,
    // Track which side of divider we're on (for wall collision)
    lastSideOfDivider: position[0] < 0.3 ? -1 : 1,
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
    // Write initial position to shared array
    if (sharedPositions) {
      sharedPositions[agentIndex * 2] = position[0];
      sharedPositions[agentIndex * 2 + 1] = position[2];
    }
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
          b.stateDuration = 999;
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
          if (status === 'roaming' && roamWaypoints.length > 0) {
            pickNextWaypoint();
          } else {
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

    // Track if this is a mobile state (needs collision)
    const isWalking = b.internalState === 'walking-to-meeting'
      || b.internalState === 'walking-to-waypoint'
      || b.internalState === 'returning-to-desk';
    const isPausing = b.internalState === 'pausing-at-waypoint';

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
        let px = THREE.MathUtils.lerp(b.startPos.x, b.targetPos.x, ease);
        let pz = THREE.MathUtils.lerp(b.startPos.z, b.targetPos.z, ease);

        // ── COLLISION RESOLUTION ──
        if (collisionData && sharedPositions) {
          // 1. Agent-agent separation
          for (let i = 0; i < totalAgents; i++) {
            if (i === agentIndex) continue;
            const ox = sharedPositions[i * 2];
            const oz = sharedPositions[i * 2 + 1];
            const adx = px - ox;
            const adz = pz - oz;
            const adist = Math.sqrt(adx * adx + adz * adz);
            if (adist < collisionData.minAgentDist && adist > 0.001) {
              const push = (collisionData.minAgentDist - adist) * 0.5;
              px += (adx / adist) * push;
              pz += (adz / adist) * push;
            }
          }

          // 2. Obstacle AABB pushout (desks)
          for (let i = 0; i < collisionData.obstacles.length; i++) {
            const ob = collisionData.obstacles[i];
            if (px > ob.minX && px < ob.maxX && pz > ob.minZ && pz < ob.maxZ) {
              // Find shortest escape direction
              const escapeLeft = px - ob.minX;
              const escapeRight = ob.maxX - px;
              const escapeTop = pz - ob.minZ;
              const escapeBottom = ob.maxZ - pz;
              const minEscape = Math.min(escapeLeft, escapeRight, escapeTop, escapeBottom);
              if (minEscape === escapeLeft) px = ob.minX;
              else if (minEscape === escapeRight) px = ob.maxX;
              else if (minEscape === escapeTop) pz = ob.minZ;
              else pz = ob.maxZ;
            }
          }

          // 3. Meeting table circle collision (only for non-meeting agents)
          if (b.internalState !== 'walking-to-meeting') {
            const mt = collisionData.meetingTable;
            const mtdx = px - mt.x;
            const mtdz = pz - mt.z;
            const mtdist = Math.sqrt(mtdx * mtdx + mtdz * mtdz);
            const mtMinDist = mt.radius + collisionData.agentRadius;
            if (mtdist < mtMinDist && mtdist > 0.001) {
              px = mt.x + (mtdx / mtdist) * mtMinDist;
              pz = mt.z + (mtdz / mtdist) * mtMinDist;
            }
          }

          // 4. Divider wall collision
          const div = collisionData.divider;
          const inDoorZone = pz > div.doorZMin && pz < div.doorZMax;
          if (!inDoorZone) {
            const wallPad = collisionData.agentRadius;
            // If agent is trying to cross the wall
            if (b.lastSideOfDivider < 0 && px > div.x - wallPad) {
              px = div.x - wallPad;
            } else if (b.lastSideOfDivider > 0 && px < div.x + wallPad) {
              px = div.x + wallPad;
            }
          } else {
            // In door zone — update side tracking
            if (px < div.x) b.lastSideOfDivider = -1;
            else b.lastSideOfDivider = 1;
          }

          // 5. Room bounds clamping
          const rb = collisionData.roomBounds;
          if (px < rb.minX) px = rb.minX;
          if (px > rb.maxX) px = rb.maxX;
          if (pz < rb.minZ) pz = rb.minZ;
          if (pz > rb.maxZ) pz = rb.maxZ;
        }

        groupRef.current.position.x = px;
        groupRef.current.position.z = pz;
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
        b.currentPos.set(px, 0, pz);
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
        let px = b.currentPos.x;
        let pz = b.currentPos.z;

        // Apply agent-agent separation even while pausing
        if (collisionData && sharedPositions) {
          for (let i = 0; i < totalAgents; i++) {
            if (i === agentIndex) continue;
            const ox = sharedPositions[i * 2];
            const oz = sharedPositions[i * 2 + 1];
            const adx = px - ox;
            const adz = pz - oz;
            const adist = Math.sqrt(adx * adx + adz * adz);
            if (adist < collisionData.minAgentDist && adist > 0.001) {
              const push = (collisionData.minAgentDist - adist) * 0.3;
              px += (adx / adist) * push;
              pz += (adz / adist) * push;
            }
          }

          // Room bounds
          const rb = collisionData.roomBounds;
          if (px < rb.minX) px = rb.minX;
          if (px > rb.maxX) px = rb.maxX;
          if (pz < rb.minZ) pz = rb.minZ;
          if (pz > rb.maxZ) pz = rb.maxZ;
        }

        groupRef.current.position.x = px;
        groupRef.current.position.z = pz;
        groupRef.current.position.y = Math.sin(t * 0.8 + b.bobPhase) * 0.005;
        b.targetRotY += Math.sin(t * 0.5 + b.bobPhase) * 0.002;
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.x = 0;
        groupRef.current.rotation.z = 0;
        const pauseBreathe = 1 + Math.sin(t * 0.9 + b.bobPhase) * 0.003;
        groupRef.current.scale.set(scale * pauseBreathe, scale * pauseBreathe, scale * pauseBreathe);
        b.currentPos.set(px, 0, pz);
        break;
      }
    }

    // Always write current position to shared array for other agents to read
    if (sharedPositions) {
      sharedPositions[agentIndex * 2] = groupRef.current.position.x;
      sharedPositions[agentIndex * 2 + 1] = groupRef.current.position.z;
    }

    // Update divider side tracking based on current position
    if (collisionData) {
      if (groupRef.current.position.x < collisionData.divider.x) {
        b.lastSideOfDivider = -1;
      } else {
        b.lastSideOfDivider = 1;
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
