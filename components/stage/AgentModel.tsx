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

  // Walk speed varies per agent (0.7 to 0.9, slow calm pace)
  const walkSpeed = useMemo(() => 0.7 + (agentIndex * 0.035) % 0.2, [agentIndex]);

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
    // Rendered position (includes steering offset — the true visual position)
    renderedX: position[0],
    renderedZ: position[2],
    // Smoothed movement direction for rotation (avoids jitter from micro-steering)
    smoothDirX: 0,
    smoothDirZ: 0,
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
    // Use the actual rendered position as the start (avoids teleport from steering offset)
    b.currentPos.set(b.renderedX, 0, b.renderedZ);
    const path = planPath(b.currentPos, finalTarget, collisionData);
    b.path = path;
    b.pathIndex = 0;
    b.postPathState = postState;
    // Do NOT reset smoothAvoid — let it decay naturally via lerp

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
      // Use rendered position (not target) to avoid snap teleport
      b.currentPos.set(b.renderedX, 0, b.renderedZ);

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
            // Don't snap to homePos — let idle/working lerp from current rendered pos
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
    // Gentle sine ease — smooth start and stop, no abrupt acceleration
    const ease = -(Math.cos(Math.PI * progress) - 1) / 2;

    // Smooth rotation (slow turn for fluid feel)
    b.currentRotY = THREE.MathUtils.lerp(b.currentRotY, b.targetRotY, 0.03);

    switch (b.internalState) {
      case 'idle': {
        // Smoothly lerp to home position (prevents snap after returning-to-desk)
        const idleX = THREE.MathUtils.lerp(b.renderedX, b.homePos.x, 0.08);
        const idleZ = THREE.MathUtils.lerp(b.renderedZ, b.homePos.z, 0.08);
        groupRef.current.position.x = idleX;
        groupRef.current.position.z = idleZ;
        groupRef.current.position.y = Math.sin(t * 0.6 + b.bobPhase) * 0.003;
        groupRef.current.rotation.x = 0;
        b.targetRotY = rotation[1] * Math.PI / 180;
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.z = 0;
        const idleBreathe = 1 + Math.sin(t * 0.6 + b.bobPhase) * 0.002;
        groupRef.current.scale.set(scale * idleBreathe, scale * idleBreathe, scale * idleBreathe);
        b.renderedX = idleX;
        b.renderedZ = idleZ;
        b.currentPos.set(idleX, 0, idleZ);
        // Decay steering offset while stationary
        b.smoothAvoidX *= 0.9;
        b.smoothAvoidZ *= 0.9;
        break;
      }

      case 'working': {
        // Smoothly lerp to home position
        const workX = THREE.MathUtils.lerp(b.renderedX, b.homePos.x, 0.08);
        const workZ = THREE.MathUtils.lerp(b.renderedZ, b.homePos.z, 0.08);
        groupRef.current.position.x = workX;
        groupRef.current.position.z = workZ;
        groupRef.current.position.y = Math.sin(t * 1.2 + b.bobPhase) * 0.008;
        groupRef.current.rotation.x = Math.sin(t * 0.8 + b.bobPhase) * 0.02;
        b.targetRotY = rotation[1] * Math.PI / 180;
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.z = Math.sin(t * 1.5 + b.bobPhase) * 0.01;
        const breathe = 1 + Math.sin(t * 1.2 + b.bobPhase) * 0.005;
        groupRef.current.scale.set(scale * breathe, scale * breathe, scale * breathe);
        b.renderedX = workX;
        b.renderedZ = workZ;
        b.currentPos.set(workX, 0, workZ);
        b.smoothAvoidX *= 0.9;
        b.smoothAvoidZ *= 0.9;
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

        // 3. Look-ahead point (further ahead for earlier avoidance)
        const lookDist = 1.8;
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

          // 6. Agent avoidance — omnidirectional, strong separation
          for (let i = 0; i < totalAgents; i++) {
            if (i === agentIndex) continue;
            const ox = sharedPositions[i * 2];
            const oz = sharedPositions[i * 2 + 1];
            const awayX = px - ox;
            const awayZ = pz - oz;
            const dist = Math.sqrt(awayX * awayX + awayZ * awayZ);
            if (dist < 2.0 && dist > 0.001) {
              // Stronger force the closer they are (quadratic falloff)
              const t01 = (2.0 - dist) / 2.0;
              const strength = t01 * t01 * 1.2;
              avoidX += (awayX / dist) * strength;
              avoidZ += (awayZ / dist) * strength;
            }
          }
        }

        // 7. Smooth the avoidance force (gentle lerp for fluid curves)
        const lerpRate = 0.06;
        b.smoothAvoidX = b.smoothAvoidX + (avoidX - b.smoothAvoidX) * lerpRate;
        b.smoothAvoidZ = b.smoothAvoidZ + (avoidZ - b.smoothAvoidZ) * lerpRate;

        // 8. Apply steering offset
        px += b.smoothAvoidX;
        pz += b.smoothAvoidZ;

        // 9. Soft boundary forces (no hard clamps — everything is gradual)
        if (collisionData) {
          // Divider wall — soft push instead of hard clamp
          const div = collisionData.divider;
          const inDoorZone = pz > div.doorZMin && pz < div.doorZMax;
          if (!inDoorZone) {
            const wallPad = collisionData.agentRadius + 0.1;
            if (b.lastSideOfDivider < 0) {
              const penetration = px - (div.x - wallPad);
              if (penetration > 0) px -= penetration * 0.3;
            } else {
              const penetration = (div.x + wallPad) - px;
              if (penetration > 0) px += penetration * 0.3;
            }
          } else {
            if (px < div.x) b.lastSideOfDivider = -1;
            else b.lastSideOfDivider = 1;
          }

          // Room bounds — soft push
          const rb = collisionData.roomBounds;
          if (px < rb.minX) px = THREE.MathUtils.lerp(px, rb.minX, 0.3);
          if (px > rb.maxX) px = THREE.MathUtils.lerp(px, rb.maxX, 0.3);
          if (pz < rb.minZ) pz = THREE.MathUtils.lerp(pz, rb.minZ, 0.3);
          if (pz > rb.maxZ) pz = THREE.MathUtils.lerp(pz, rb.maxZ, 0.3);

          // Obstacle AABB — soft push outward (no snap)
          for (let i = 0; i < collisionData.obstacles.length; i++) {
            const ob = collisionData.obstacles[i];
            if (px > ob.minX && px < ob.maxX && pz > ob.minZ && pz < ob.maxZ) {
              const escapeLeft = px - ob.minX;
              const escapeRight = ob.maxX - px;
              const escapeTop = pz - ob.minZ;
              const escapeBottom = ob.maxZ - pz;
              const minEscape = Math.min(escapeLeft, escapeRight, escapeTop, escapeBottom);
              const pushRate = 0.4;
              if (minEscape === escapeLeft) px -= escapeLeft * pushRate;
              else if (minEscape === escapeRight) px += escapeRight * pushRate;
              else if (minEscape === escapeTop) pz -= escapeTop * pushRate;
              else pz += escapeBottom * pushRate;
            }
          }

          // Meeting table circle — soft push (safety)
          if (b.internalState !== 'walking-to-meeting') {
            const mt = collisionData.meetingTable;
            const mtdx = px - mt.x;
            const mtdz = pz - mt.z;
            const mtdist = Math.sqrt(mtdx * mtdx + mtdz * mtdz);
            const mtMinDist = mt.radius + collisionData.agentRadius;
            if (mtdist < mtMinDist && mtdist > 0.001) {
              const pushAmount = (mtMinDist - mtdist) * 0.3;
              px += (mtdx / mtdist) * pushAmount;
              pz += (mtdz / mtdist) * pushAmount;
            }
          }
        }

        // 10. Per-frame movement cap — prevents teleportation from any source
        const maxStep = 0.15; // max distance per frame (~9 units/sec at 60fps)
        const moveX = px - b.renderedX;
        const moveZ = pz - b.renderedZ;
        const moveDist = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (moveDist > maxStep) {
          const clampRatio = maxStep / moveDist;
          px = b.renderedX + moveX * clampRatio;
          pz = b.renderedZ + moveZ * clampRatio;
        }

        groupRef.current.position.x = px;
        groupRef.current.position.z = pz;
        // Gentle walk bob (slow frequency, low amplitude)
        groupRef.current.position.y = Math.abs(Math.sin(t * 4)) * 0.015;

        // 11. Rotation based on smoothed movement direction (prevents spinning)
        const frameDx = px - b.prevFrameX;
        const frameDz = pz - b.prevFrameZ;
        // Smooth the direction vector over many frames to filter oscillation
        b.smoothDirX = b.smoothDirX * 0.85 + frameDx * 0.15;
        b.smoothDirZ = b.smoothDirZ * 0.85 + frameDz * 0.15;
        // Only update rotation when there's meaningful sustained movement
        const smoothDirLen = Math.sqrt(b.smoothDirX * b.smoothDirX + b.smoothDirZ * b.smoothDirZ);
        if (smoothDirLen > 0.005) {
          b.targetRotY = Math.atan2(b.smoothDirX, b.smoothDirZ);
        }
        b.prevFrameX = px;
        b.prevFrameZ = pz;
        b.renderedX = px;
        b.renderedZ = pz;

        groupRef.current.rotation.y = b.currentRotY;
        // Subtle body sway while walking
        groupRef.current.rotation.z = Math.sin(t * 3) * 0.015;
        groupRef.current.rotation.x = 0;
        groupRef.current.scale.set(scale, scale, scale);
        b.currentPos.set(px, 0, pz);
        break;
      }

      case 'meeting': {
        // Smoothly settle into seat (prevents snap from walking offset)
        const mtX = THREE.MathUtils.lerp(b.renderedX, b.meetingSeat.x, 0.1);
        const mtZ = THREE.MathUtils.lerp(b.renderedZ, b.meetingSeat.z, 0.1);
        groupRef.current.position.x = mtX;
        groupRef.current.position.z = mtZ;
        groupRef.current.position.y = Math.sin(t * 1.5 + b.bobPhase) * 0.01;
        const toDx = 5.5 - b.meetingSeat.x;
        const toDz = 0 - b.meetingSeat.z;
        b.targetRotY = Math.atan2(toDx, toDz);
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.x = Math.sin(t * 2.5 + b.bobPhase) * 0.04;
        groupRef.current.rotation.z = Math.sin(t * 1.8 + b.bobPhase) * 0.02;
        groupRef.current.scale.set(scale, scale, scale);
        b.renderedX = mtX;
        b.renderedZ = mtZ;
        b.currentPos.set(mtX, 0, mtZ);
        b.smoothAvoidX *= 0.9;
        b.smoothAvoidZ *= 0.9;
        break;
      }

      case 'pausing-at-waypoint': {
        // Agent is stationary — walkers steer around us via their own steering
        groupRef.current.position.x = b.renderedX;
        groupRef.current.position.z = b.renderedZ;
        groupRef.current.position.y = Math.sin(t * 0.8 + b.bobPhase) * 0.005;
        b.targetRotY += Math.sin(t * 0.5 + b.bobPhase) * 0.002;
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.x = 0;
        groupRef.current.rotation.z = 0;
        const pauseBreathe = 1 + Math.sin(t * 0.9 + b.bobPhase) * 0.003;
        groupRef.current.scale.set(scale * pauseBreathe, scale * pauseBreathe, scale * pauseBreathe);
        b.currentPos.set(b.renderedX, 0, b.renderedZ);
        b.smoothAvoidX *= 0.9;
        b.smoothAvoidZ *= 0.9;
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
