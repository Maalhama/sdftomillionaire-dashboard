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

// ── PATH PLANNING ──
// Plans a multi-segment path from `from` to `to`, inserting door waypoints
// when the agent needs to cross the divider wall.
function planPath(
  from: THREE.Vector3,
  to: THREE.Vector3,
  collisionData: CollisionData | undefined,
): THREE.Vector3[] {
  if (!collisionData) return [to.clone()];

  const div = collisionData.divider;
  const fromSide = from.x < div.x ? -1 : 1;
  const toSide = to.x < div.x ? -1 : 1;

  // Same side — direct path
  if (fromSide === toSide) return [to.clone()];

  // Different side — route through door
  const doorCenterZ = (div.doorZMin + div.doorZMax) / 2; // 0
  const approachOffset = 0.6;

  const approachDoor = new THREE.Vector3(
    div.x + fromSide * approachOffset,
    0,
    doorCenterZ,
  );
  const exitDoor = new THREE.Vector3(
    div.x + toSide * approachOffset,
    0,
    doorCenterZ,
  );

  return [approachDoor, exitDoor, to.clone()];
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
    // Track which side of divider we're on
    lastSideOfDivider: position[0] < 0.3 ? -1 : 1,
    // ── Path planning ──
    path: [] as THREE.Vector3[],
    pathIndex: 0,
    // ── Smooth steering ──
    smoothAvoidX: 0,
    smoothAvoidZ: 0,
    prevFrameX: position[0],
    prevFrameZ: position[2],
    // Remember what state to go to after entire path completes
    postPathState: null as InternalState | null,
  });

  const b = behaviorRef.current;

  // Compute walk duration based on distance
  const computeWalkDuration = (from: THREE.Vector3, to: THREE.Vector3) => {
    const dist = from.distanceTo(to);
    return Math.max(0.5, dist / walkSpeed);
  };

  // Start walking the first segment of a planned path
  const startPathWalk = (
    finalTarget: THREE.Vector3,
    walkState: InternalState,
    postState: InternalState | null,
  ) => {
    const path = planPath(b.currentPos, finalTarget, collisionData);
    b.path = path;
    b.pathIndex = 0;
    b.postPathState = postState;
    b.smoothAvoidX = 0;
    b.smoothAvoidZ = 0;

    // Set up first segment
    const firstTarget = path[0];
    b.startPos.copy(b.currentPos);
    b.targetPos.copy(firstTarget);
    b.stateTimer = 0;
    b.stateDuration = computeWalkDuration(b.currentPos, firstTarget);
    b.internalState = walkState;
  };

  // Legacy wrapper for compatibility
  const startWalkTo = (target: THREE.Vector3, nextState: InternalState) => {
    // Determine post-path state based on walk type
    let postState: InternalState | null = null;
    if (nextState === 'walking-to-meeting') postState = 'meeting';
    else if (nextState === 'walking-to-waypoint') postState = 'pausing-at-waypoint';
    else if (nextState === 'returning-to-desk') postState = status === 'working' ? 'working' : 'idle';
    startPathWalk(target, nextState, postState);
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

    const isWalking = b.internalState === 'walking-to-meeting'
      || b.internalState === 'walking-to-waypoint'
      || b.internalState === 'returning-to-desk';

    // ── Segment completion + path advancement ──
    if (b.stateTimer >= b.stateDuration && isWalking) {
      b.currentPos.copy(b.targetPos);

      // More segments in the path?
      if (b.pathIndex < b.path.length - 1) {
        b.pathIndex++;
        const nextSeg = b.path[b.pathIndex];
        b.startPos.copy(b.currentPos);
        b.targetPos.copy(nextSeg);
        b.stateTimer = 0;
        b.stateDuration = computeWalkDuration(b.currentPos, nextSeg);
        // Stay in current walking state
      } else {
        // Path complete — transition to post-path state
        switch (b.internalState) {
          case 'walking-to-meeting': {
            b.currentPos.copy(b.meetingSeat);
            b.internalState = 'meeting';
            b.stateTimer = 0;
            b.stateDuration = 999;
            break;
          }
          case 'walking-to-waypoint': {
            b.internalState = 'pausing-at-waypoint';
            b.stateTimer = 0;
            b.pauseDuration = 2 + Math.random() * 3;
            b.stateDuration = b.pauseDuration;
            break;
          }
          case 'returning-to-desk': {
            b.currentPos.copy(b.homePos);
            b.internalState = status === 'working' ? 'working' : 'idle';
            b.stateTimer = 0;
            b.stateDuration = 999;
            break;
          }
        }
      }
    }

    // Non-walking state transitions
    if (b.stateTimer >= b.stateDuration && !isWalking) {
      switch (b.internalState) {
        case 'pausing-at-waypoint': {
          if (status === 'roaming' && roamWaypoints.length > 0) {
            pickNextWaypoint();
          } else {
            startWalkTo(b.homePos, 'returning-to-desk');
          }
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
        // 1. Base lerp position along current segment
        let px = THREE.MathUtils.lerp(b.startPos.x, b.targetPos.x, ease);
        let pz = THREE.MathUtils.lerp(b.startPos.z, b.targetPos.z, ease);

        // 2. Compute walk direction (normalized)
        const segDx = b.targetPos.x - b.startPos.x;
        const segDz = b.targetPos.z - b.startPos.z;
        const segLen = Math.sqrt(segDx * segDx + segDz * segDz);
        const ndx = segLen > 0.01 ? segDx / segLen : 0;
        const ndz = segLen > 0.01 ? segDz / segLen : 0;

        // 3. Look-ahead point
        const lookDist = 1.2;
        const laX = px + ndx * lookDist;
        const laZ = pz + ndz * lookDist;

        // ── STEERING FORCES ──
        let avoidX = 0;
        let avoidZ = 0;

        if (collisionData && sharedPositions) {
          // 4. Obstacle avoidance (desks AABB)
          for (let i = 0; i < collisionData.obstacles.length; i++) {
            const ob = collisionData.obstacles[i];
            // Check if look-ahead point is inside obstacle
            if (laX > ob.minX && laX < ob.maxX && laZ > ob.minZ && laZ < ob.maxZ) {
              // Steer away from obstacle center
              const obCx = (ob.minX + ob.maxX) / 2;
              const obCz = (ob.minZ + ob.maxZ) / 2;
              const awayX = px - obCx;
              const awayZ = pz - obCz;
              const awayLen = Math.sqrt(awayX * awayX + awayZ * awayZ);
              if (awayLen > 0.01) {
                avoidX += (awayX / awayLen) * 0.8;
                avoidZ += (awayZ / awayLen) * 0.8;
              }
            }
            // Also check if current position is very close to AABB (proximity force)
            const clampX = Math.max(ob.minX, Math.min(px, ob.maxX));
            const clampZ = Math.max(ob.minZ, Math.min(pz, ob.maxZ));
            const distToOb = Math.sqrt((px - clampX) ** 2 + (pz - clampZ) ** 2);
            if (distToOb < 0.3 && distToOb > 0.001) {
              const repelStr = (0.3 - distToOb) / 0.3;
              avoidX += ((px - clampX) / distToOb) * repelStr * 0.5;
              avoidZ += ((pz - clampZ) / distToOb) * repelStr * 0.5;
            }
          }

          // 5. Meeting table circle avoidance (skip for walking-to-meeting)
          if (b.internalState !== 'walking-to-meeting') {
            const mt = collisionData.meetingTable;
            const mtMinDist = mt.radius + collisionData.agentRadius + 0.2;
            // Check look-ahead against table
            const laMtDx = laX - mt.x;
            const laMtDz = laZ - mt.z;
            const laMtDist = Math.sqrt(laMtDx * laMtDx + laMtDz * laMtDz);
            if (laMtDist < mtMinDist && laMtDist > 0.01) {
              const pushStr = (mtMinDist - laMtDist) / mtMinDist;
              avoidX += (laMtDx / laMtDist) * pushStr * 0.8;
              avoidZ += (laMtDz / laMtDist) * pushStr * 0.8;
            }
            // Also check current position proximity
            const curMtDx = px - mt.x;
            const curMtDz = pz - mt.z;
            const curMtDist = Math.sqrt(curMtDx * curMtDx + curMtDz * curMtDz);
            if (curMtDist < mtMinDist && curMtDist > 0.01) {
              const pushStr = (mtMinDist - curMtDist) / mtMinDist;
              avoidX += (curMtDx / curMtDist) * pushStr * 0.6;
              avoidZ += (curMtDz / curMtDist) * pushStr * 0.6;
            }
          }

          // 6. Agent avoidance (only agents ahead of us)
          for (let i = 0; i < totalAgents; i++) {
            if (i === agentIndex) continue;
            const ox = sharedPositions[i * 2];
            const oz = sharedPositions[i * 2 + 1];
            const toDx = ox - px;
            const toDz = oz - pz;
            const dist = Math.sqrt(toDx * toDx + toDz * toDz);
            if (dist < 1.5 && dist > 0.001) {
              // Dot product: is this agent in front of us?
              const dot = ndx * toDx + ndz * toDz;
              if (dot > -0.3) {
                // Steer away perpendicular to walk direction
                const awayX = px - ox;
                const awayZ = pz - oz;
                const awayLen = Math.sqrt(awayX * awayX + awayZ * awayZ);
                if (awayLen > 0.01) {
                  const strength = (1.5 - dist) / 1.5 * 0.6;
                  avoidX += (awayX / awayLen) * strength;
                  avoidZ += (awayZ / awayLen) * strength;
                }
              }
            }
          }
        }

        // 7. Smooth the avoidance force (lerp toward target)
        const lerpRate = 0.1;
        b.smoothAvoidX = b.smoothAvoidX + (avoidX - b.smoothAvoidX) * lerpRate;
        b.smoothAvoidZ = b.smoothAvoidZ + (avoidZ - b.smoothAvoidZ) * lerpRate;

        // 8. Apply steering offset
        px += b.smoothAvoidX;
        pz += b.smoothAvoidZ;

        // 9. Safety clamp — room bounds + divider wall (rarely triggers)
        if (collisionData) {
          // Divider wall hard clamp
          const div = collisionData.divider;
          const inDoorZone = pz > div.doorZMin && pz < div.doorZMax;
          if (!inDoorZone) {
            const wallPad = collisionData.agentRadius;
            if (b.lastSideOfDivider < 0 && px > div.x - wallPad) {
              px = div.x - wallPad;
            } else if (b.lastSideOfDivider > 0 && px < div.x + wallPad) {
              px = div.x + wallPad;
            }
          } else {
            if (px < div.x) b.lastSideOfDivider = -1;
            else b.lastSideOfDivider = 1;
          }

          // Room bounds
          const rb = collisionData.roomBounds;
          if (px < rb.minX) px = rb.minX;
          if (px > rb.maxX) px = rb.maxX;
          if (pz < rb.minZ) pz = rb.minZ;
          if (pz > rb.maxZ) pz = rb.maxZ;

          // Hard obstacle clamp (safety net — should rarely fire with steering)
          for (let i = 0; i < collisionData.obstacles.length; i++) {
            const ob = collisionData.obstacles[i];
            if (px > ob.minX && px < ob.maxX && pz > ob.minZ && pz < ob.maxZ) {
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

          // Hard meeting table clamp (safety)
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
        }

        groupRef.current.position.x = px;
        groupRef.current.position.z = pz;
        groupRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.035;

        // 10. Rotation based on actual frame-to-frame movement direction
        const frameDx = px - b.prevFrameX;
        const frameDz = pz - b.prevFrameZ;
        if (Math.abs(frameDx) > 0.001 || Math.abs(frameDz) > 0.001) {
          b.targetRotY = Math.atan2(frameDx, frameDz);
        }
        b.prevFrameX = px;
        b.prevFrameZ = pz;

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
        // Agent is stationary — walkers steer around us via their own steering
        const px = b.currentPos.x;
        const pz = b.currentPos.z;

        groupRef.current.position.x = px;
        groupRef.current.position.z = pz;
        groupRef.current.position.y = Math.sin(t * 0.8 + b.bobPhase) * 0.005;
        b.targetRotY += Math.sin(t * 0.5 + b.bobPhase) * 0.002;
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.x = 0;
        groupRef.current.rotation.z = 0;
        const pauseBreathe = 1 + Math.sin(t * 0.9 + b.bobPhase) * 0.003;
        groupRef.current.scale.set(scale * pauseBreathe, scale * pauseBreathe, scale * pauseBreathe);
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
