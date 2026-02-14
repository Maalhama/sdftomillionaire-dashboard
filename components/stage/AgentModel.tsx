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
  | 'quest-received'
  | 'walking-to-meeting'
  | 'meeting'
  | 'walking-to-waypoint'
  | 'pausing-at-waypoint'
  | 'returning-to-desk';

// Encoded internal states for shared communication with HQRoom3D
export const INTERNAL_STATE_CODES: Record<InternalState, number> = {
  'idle': 0,
  'working': 1,
  'quest-received': 2,
  'walking-to-meeting': 3,
  'meeting': 4,
  'walking-to-waypoint': 5,
  'pausing-at-waypoint': 6,
  'returning-to-desk': 7,
};

// Fisher-Yates shuffle
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── AGENT PERSONALITIES ──
// Each agent has slightly different movement characteristics
const PERSONALITIES = [
  { maxSpeed: 1.4, accel: 1.8, turnSmooth: 0.06, wobbleAmp: 0.08, wobbleFreq: 0.7 },  // CEO — brisk
  { maxSpeed: 1.1, accel: 1.4, turnSmooth: 0.04, wobbleAmp: 0.12, wobbleFreq: 0.5 },  // KIRA — methodical
  { maxSpeed: 1.6, accel: 2.2, turnSmooth: 0.07, wobbleAmp: 0.06, wobbleFreq: 0.9 },  // MADARA — energetic
  { maxSpeed: 1.2, accel: 1.5, turnSmooth: 0.05, wobbleAmp: 0.10, wobbleFreq: 0.6 },  // STARK — relaxed
  { maxSpeed: 1.3, accel: 1.6, turnSmooth: 0.05, wobbleAmp: 0.09, wobbleFreq: 0.8 },  // L — steady
  { maxSpeed: 1.0, accel: 1.3, turnSmooth: 0.03, wobbleAmp: 0.14, wobbleFreq: 0.4 },  // USOPP — cautious
];

// ── PATH PLANNING ──
function planPath(
  from: THREE.Vector3,
  to: THREE.Vector3,
  collisionData: CollisionData | undefined,
): THREE.Vector3[] {
  if (!collisionData) return [to.clone()];

  const div = collisionData.divider;
  const fromSide = from.x < div.x ? -1 : 1;
  const toSide = to.x < div.x ? -1 : 1;

  if (fromSide === toSide) return [to.clone()];

  // Use agent's current Z to pick a natural crossing point within the door
  // Clamp to door bounds with padding so agents spread across the full opening
  const doorPad = 0.6;
  const clampedZ = Math.max(div.doorZMin + doorPad, Math.min(div.doorZMax - doorPad, from.z));
  const approachOffset = 0.8;

  return [
    new THREE.Vector3(div.x + fromSide * approachOffset, 0, clampedZ),
    new THREE.Vector3(div.x + toSide * approachOffset, 0, clampedZ),
    to.clone(),
  ];
}

// Cheap pseudo-noise for walk variation (no dependency needed)
function noise(seed: number, t: number): number {
  const x = Math.sin(seed * 127.1 + t * 1.17) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1; // [-1, 1]
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
  sharedInternalStates?: Float32Array;
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
  sharedInternalStates,
  totalAgents = 6,
}: AgentModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelPath);

  const personality = PERSONALITIES[agentIndex % PERSONALITIES.length];
  const noiseSeed = useMemo(() => agentIndex * 73.37, [agentIndex]);

  const behaviorRef = useRef({
    internalState: 'idle' as InternalState,
    stateTimer: 0,
    prevStatus: status,
    // Position
    px: position[0],
    pz: position[2],
    homeX: position[0],
    homeZ: position[2],
    // ── Velocity-based movement ──
    vx: 0,
    vz: 0,
    // Rotation
    currentRotY: rotation[1] * Math.PI / 180,
    targetRotY: rotation[1] * Math.PI / 180,
    bobPhase: Math.random() * Math.PI * 2,
    // Path
    path: [] as THREE.Vector3[],
    pathIndex: 0,
    // Current segment target
    segTargetX: position[0],
    segTargetZ: position[2],
    // Meeting
    meetingSeatX: 0,
    meetingSeatZ: 0,
    // Roaming
    shuffledWaypoints: shuffleArray(roamWaypoints),
    waypointIndex: 0,
    pauseDuration: 2 + Math.random() * 3,
    // Divider tracking
    lastSideOfDivider: position[0] < -0.5 ? -1 : 1,
  });

  const b = behaviorRef.current;

  // ── Navigation helpers ──
  const startPath = (targetX: number, targetZ: number, walkState: InternalState) => {
    const from = new THREE.Vector3(b.px, 0, b.pz);
    const to = new THREE.Vector3(targetX, 0, targetZ);
    const path = planPath(from, to, collisionData);
    b.path = path;
    b.pathIndex = 0;
    b.segTargetX = path[0].x;
    b.segTargetZ = path[0].z;
    b.internalState = walkState;
    b.stateTimer = 0;
  };

  const startWalkTo = (tx: number, tz: number, state: InternalState) => {
    startPath(tx, tz, state);
  };

  const pickNextWaypoint = () => {
    if (b.shuffledWaypoints.length === 0) return;
    if (b.waypointIndex >= b.shuffledWaypoints.length) {
      b.shuffledWaypoints = shuffleArray(roamWaypoints);
      b.waypointIndex = 0;
    }
    const wp = b.shuffledWaypoints[b.waypointIndex];
    b.waypointIndex++;
    startWalkTo(wp[0], wp[2], 'walking-to-waypoint');
  };

  // ── Status change reactions ──
  if (status !== b.prevStatus) {
    b.prevStatus = status;
    switch (status) {
      case 'discussing': {
        if (meetingPositions.length > 0) {
          const seat = meetingPositions[agentIndex % meetingPositions.length];
          b.meetingSeatX = seat[0];
          b.meetingSeatZ = seat[2];
          // Show "!" quest bubble for 2.5s before walking to meeting
          b.internalState = 'quest-received';
          b.stateTimer = 0;
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
        const d = Math.sqrt((b.px - b.homeX) ** 2 + (b.pz - b.homeZ) ** 2);
        if (d > 0.3) startWalkTo(b.homeX, b.homeZ, 'returning-to-desk');
        else { b.internalState = 'idle'; b.stateTimer = 0; }
        break;
      }
      case 'working': {
        const d = Math.sqrt((b.px - b.homeX) ** 2 + (b.pz - b.homeZ) ** 2);
        if (d > 0.3) startWalkTo(b.homeX, b.homeZ, 'returning-to-desk');
        else { b.internalState = 'working'; b.stateTimer = 0; }
        break;
      }
    }
  }

  const { clonedScene, yOffset } = useMemo(() => {
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    return { clonedScene: clone, yOffset: -box.min.y };
  }, [scene]);

  // Initialize
  const initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    if (sharedPositions) {
      sharedPositions[agentIndex * 2] = position[0];
      sharedPositions[agentIndex * 2 + 1] = position[2];
    }
    if (status === 'discussing' && meetingPositions.length > 0) {
      const seat = meetingPositions[agentIndex % meetingPositions.length];
      b.meetingSeatX = seat[0];
      b.meetingSeatZ = seat[2];
      b.internalState = 'quest-received';
      b.stateTimer = 0;
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
    const dt = Math.min(delta, 0.05); // cap delta to prevent jumps on lag spikes

    b.stateTimer += dt;

    const isWalking = b.internalState === 'walking-to-meeting'
      || b.internalState === 'walking-to-waypoint'
      || b.internalState === 'returning-to-desk';

    // ── VELOCITY-BASED WALKING ──
    if (isWalking) {
      // Distance to current segment target
      const toTargetX = b.segTargetX - b.px;
      const toTargetZ = b.segTargetZ - b.pz;
      const distToTarget = Math.sqrt(toTargetX * toTargetX + toTargetZ * toTargetZ);

      // Check segment arrival
      const arrivalDist = 0.15;
      if (distToTarget < arrivalDist) {
        // Advance to next segment or complete path
        if (b.pathIndex < b.path.length - 1) {
          b.pathIndex++;
          b.segTargetX = b.path[b.pathIndex].x;
          b.segTargetZ = b.path[b.pathIndex].z;
        } else {
          // Path complete
          switch (b.internalState) {
            case 'walking-to-meeting':
              b.internalState = 'meeting';
              b.stateTimer = 0;
              break;
            case 'walking-to-waypoint':
              b.internalState = 'pausing-at-waypoint';
              b.stateTimer = 0;
              b.pauseDuration = 3 + Math.random() * 4;
              break;
            case 'returning-to-desk':
              b.internalState = status === 'working' ? 'working' : 'idle';
              b.stateTimer = 0;
              break;
          }
        }
      }

      if (isWalking && b.internalState === (b.internalState as string)) {
        // Recompute after potential segment change
        const tx = b.segTargetX - b.px;
        const tz = b.segTargetZ - b.pz;
        const dtt = Math.sqrt(tx * tx + tz * tz);

        // ── Desired velocity (toward target) ──
        let desiredVx = 0;
        let desiredVz = 0;
        if (dtt > 0.01) {
          const ndx = tx / dtt;
          const ndz = tz / dtt;

          // Speed profile: accelerate, cruise, then slow down near target
          const slowdownDist = 1.5;
          let speedFactor = 1.0;
          if (dtt < slowdownDist) {
            // Smooth deceleration curve
            speedFactor = 0.3 + 0.7 * (dtt / slowdownDist);
          }

          // Walk variation — slight speed/direction wobble
          const wobbleX = noise(noiseSeed, t * personality.wobbleFreq) * personality.wobbleAmp;
          const wobbleZ = noise(noiseSeed + 50, t * personality.wobbleFreq * 1.3) * personality.wobbleAmp;

          const speed = personality.maxSpeed * speedFactor;
          desiredVx = ndx * speed + wobbleX * speed * 0.15;
          desiredVz = ndz * speed + wobbleZ * speed * 0.15;
        }

        // ── Avoidance forces ──
        let avoidVx = 0;
        let avoidVz = 0;

        if (collisionData && sharedPositions) {
          // Look-ahead for obstacle detection
          const speed = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
          const lookDist = Math.max(1.5, speed * 1.2);
          const lookNorm = speed > 0.01 ? 1 / speed : 0;
          const lookDirX = b.vx * lookNorm;
          const lookDirZ = b.vz * lookNorm;
          const laX = b.px + lookDirX * lookDist;
          const laZ = b.pz + lookDirZ * lookDist;

          // Obstacle avoidance (desks)
          for (let i = 0; i < collisionData.obstacles.length; i++) {
            const ob = collisionData.obstacles[i];
            // Look-ahead check
            if (laX > ob.minX && laX < ob.maxX && laZ > ob.minZ && laZ < ob.maxZ) {
              const obCx = (ob.minX + ob.maxX) / 2;
              const obCz = (ob.minZ + ob.maxZ) / 2;
              const awayX = b.px - obCx;
              const awayZ = b.pz - obCz;
              const awayLen = Math.sqrt(awayX * awayX + awayZ * awayZ);
              if (awayLen > 0.01) {
                avoidVx += (awayX / awayLen) * 2.5;
                avoidVz += (awayZ / awayLen) * 2.5;
              }
            }
            // Proximity repulsion
            const clampX = Math.max(ob.minX, Math.min(b.px, ob.maxX));
            const clampZ = Math.max(ob.minZ, Math.min(b.pz, ob.maxZ));
            const dOb = Math.sqrt((b.px - clampX) ** 2 + (b.pz - clampZ) ** 2);
            if (dOb < 0.5 && dOb > 0.001) {
              const str = ((0.5 - dOb) / 0.5) ** 2 * 3.0;
              avoidVx += ((b.px - clampX) / dOb) * str;
              avoidVz += ((b.pz - clampZ) / dOb) * str;
            }
          }

          // Meeting table avoidance
          if (b.internalState !== 'walking-to-meeting') {
            const mt = collisionData.meetingTable;
            const mtDist = Math.sqrt((b.px - mt.x) ** 2 + (b.pz - mt.z) ** 2);
            const mtMinDist = mt.radius + collisionData.agentRadius + 0.3;
            if (mtDist < mtMinDist && mtDist > 0.01) {
              const str = ((mtMinDist - mtDist) / mtMinDist) ** 2 * 3.0;
              avoidVx += ((b.px - mt.x) / mtDist) * str;
              avoidVz += ((b.pz - mt.z) / mtDist) * str;
            }
          }

          // Agent avoidance — omnidirectional
          for (let i = 0; i < totalAgents; i++) {
            if (i === agentIndex) continue;
            const ox = sharedPositions[i * 2];
            const oz = sharedPositions[i * 2 + 1];
            const awayX = b.px - ox;
            const awayZ = b.pz - oz;
            const dist = Math.sqrt(awayX * awayX + awayZ * awayZ);
            if (dist < 2.0 && dist > 0.001) {
              const t01 = (2.0 - dist) / 2.0;
              const str = t01 * t01 * 2.5;
              avoidVx += (awayX / dist) * str;
              avoidVz += (awayZ / dist) * str;
            }
          }

          // Divider wall avoidance
          const div = collisionData.divider;
          const inDoor = b.pz > div.doorZMin && b.pz < div.doorZMax;
          if (!inDoor) {
            const wallPad = collisionData.agentRadius + 0.2;
            if (b.lastSideOfDivider < 0) {
              const pen = b.px - (div.x - wallPad);
              if (pen > -0.5) avoidVx -= Math.max(0, pen + 0.5) * 4.0;
            } else {
              const pen = (div.x + wallPad) - b.px;
              if (pen > -0.5) avoidVx += Math.max(0, pen + 0.5) * 4.0;
            }
          } else {
            if (b.px < div.x) b.lastSideOfDivider = -1;
            else b.lastSideOfDivider = 1;
          }

          // Room bounds soft walls
          const rb = collisionData.roomBounds;
          const wallSoft = 1.0;
          if (b.px < rb.minX + wallSoft) avoidVx += ((rb.minX + wallSoft - b.px) / wallSoft) * 3.0;
          if (b.px > rb.maxX - wallSoft) avoidVx -= ((b.px - rb.maxX + wallSoft) / wallSoft) * 3.0;
          if (b.pz < rb.minZ + wallSoft) avoidVz += ((rb.minZ + wallSoft - b.pz) / wallSoft) * 3.0;
          if (b.pz > rb.maxZ - wallSoft) avoidVz -= ((b.pz - rb.maxZ + wallSoft) / wallSoft) * 3.0;
        }

        // ── Combine forces and apply acceleration ──
        const totalDesiredVx = desiredVx + avoidVx;
        const totalDesiredVz = desiredVz + avoidVz;

        // Smooth acceleration toward desired velocity
        const accelRate = personality.accel * dt;
        b.vx += (totalDesiredVx - b.vx) * Math.min(accelRate, 1);
        b.vz += (totalDesiredVz - b.vz) * Math.min(accelRate, 1);

        // Speed cap
        const currentSpeed = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
        const maxSpd = personality.maxSpeed * 1.3; // allow slight overshoot from avoidance
        if (currentSpeed > maxSpd) {
          const ratio = maxSpd / currentSpeed;
          b.vx *= ratio;
          b.vz *= ratio;
        }

        // ── Integrate position ──
        b.px += b.vx * dt;
        b.pz += b.vz * dt;

        // Hard room bounds clamp (safety net only)
        if (collisionData) {
          const rb = collisionData.roomBounds;
          if (b.px < rb.minX) { b.px = rb.minX; b.vx = 0; }
          if (b.px > rb.maxX) { b.px = rb.maxX; b.vx = 0; }
          if (b.pz < rb.minZ) { b.pz = rb.minZ; b.vz = 0; }
          if (b.pz > rb.maxZ) { b.pz = rb.maxZ; b.vz = 0; }
        }
      }

      // ── Rotation from velocity ──
      const spd = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
      if (spd > 0.05) {
        b.targetRotY = Math.atan2(b.vx, b.vz);
      }
      b.currentRotY = THREE.MathUtils.lerp(b.currentRotY, b.targetRotY, personality.turnSmooth);

      // ── Walk animation ──
      // Bob proportional to speed (faster = more bounce)
      const bobIntensity = Math.min(spd / personality.maxSpeed, 1);
      const bobFreq = 4 + spd * 2;
      groupRef.current.position.x = b.px;
      groupRef.current.position.z = b.pz;
      groupRef.current.position.y = Math.abs(Math.sin(t * bobFreq + b.bobPhase)) * 0.02 * bobIntensity;
      groupRef.current.rotation.y = b.currentRotY;
      groupRef.current.rotation.z = Math.sin(t * bobFreq * 0.5 + b.bobPhase) * 0.02 * bobIntensity;
      groupRef.current.rotation.x = 0;
      groupRef.current.scale.set(scale, scale, scale);
    }

    // ── STATIONARY STATES ──
    switch (b.internalState) {
      case 'idle': {
        // Drift smoothly to home
        b.px = THREE.MathUtils.lerp(b.px, b.homeX, 0.06);
        b.pz = THREE.MathUtils.lerp(b.pz, b.homeZ, 0.06);
        // Decay velocity
        b.vx *= 0.85;
        b.vz *= 0.85;

        groupRef.current.position.x = b.px;
        groupRef.current.position.z = b.pz;
        groupRef.current.position.y = Math.sin(t * 0.6 + b.bobPhase) * 0.003;
        b.targetRotY = rotation[1] * Math.PI / 180;
        b.currentRotY = THREE.MathUtils.lerp(b.currentRotY, b.targetRotY, 0.03);
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.x = 0;
        groupRef.current.rotation.z = 0;
        const idleBreathe = 1 + Math.sin(t * 0.6 + b.bobPhase) * 0.002;
        groupRef.current.scale.set(scale * idleBreathe, scale * idleBreathe, scale * idleBreathe);
        break;
      }

      case 'working': {
        b.px = THREE.MathUtils.lerp(b.px, b.homeX, 0.06);
        b.pz = THREE.MathUtils.lerp(b.pz, b.homeZ, 0.06);
        b.vx *= 0.85;
        b.vz *= 0.85;

        groupRef.current.position.x = b.px;
        groupRef.current.position.z = b.pz;
        groupRef.current.position.y = Math.sin(t * 1.2 + b.bobPhase) * 0.008;
        groupRef.current.rotation.x = Math.sin(t * 0.8 + b.bobPhase) * 0.02;
        b.targetRotY = rotation[1] * Math.PI / 180;
        b.currentRotY = THREE.MathUtils.lerp(b.currentRotY, b.targetRotY, 0.03);
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.z = Math.sin(t * 1.5 + b.bobPhase) * 0.01;
        const breathe = 1 + Math.sin(t * 1.2 + b.bobPhase) * 0.005;
        groupRef.current.scale.set(scale * breathe, scale * breathe, scale * breathe);
        break;
      }

      case 'quest-received': {
        // Stay at current position with excited bounce for 2.5s
        b.vx *= 0.85;
        b.vz *= 0.85;

        groupRef.current.position.x = b.px;
        groupRef.current.position.z = b.pz;
        // Excited bounce animation
        const questBounce = Math.abs(Math.sin(t * 6 + b.bobPhase)) * 0.04;
        groupRef.current.position.y = questBounce;
        b.targetRotY = rotation[1] * Math.PI / 180;
        b.currentRotY = THREE.MathUtils.lerp(b.currentRotY, b.targetRotY, 0.03);
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.x = Math.sin(t * 4 + b.bobPhase) * 0.03;
        groupRef.current.rotation.z = 0;
        const questScale = 1 + Math.sin(t * 5) * 0.01;
        groupRef.current.scale.set(scale * questScale, scale * questScale, scale * questScale);

        // After 2.5s → walk to meeting
        if (b.stateTimer >= 2.5) {
          startWalkTo(b.meetingSeatX, b.meetingSeatZ, 'walking-to-meeting');
        }
        break;
      }

      case 'meeting': {
        // Settle into seat
        b.px = THREE.MathUtils.lerp(b.px, b.meetingSeatX, 0.08);
        b.pz = THREE.MathUtils.lerp(b.pz, b.meetingSeatZ, 0.08);
        b.vx *= 0.85;
        b.vz *= 0.85;

        groupRef.current.position.x = b.px;
        groupRef.current.position.z = b.pz;
        groupRef.current.position.y = Math.sin(t * 1.5 + b.bobPhase) * 0.01;
        const toDx = 7 - b.meetingSeatX;
        const toDz = 0 - b.meetingSeatZ;
        b.targetRotY = Math.atan2(toDx, toDz);
        b.currentRotY = THREE.MathUtils.lerp(b.currentRotY, b.targetRotY, 0.04);
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.x = Math.sin(t * 2.5 + b.bobPhase) * 0.04;
        groupRef.current.rotation.z = Math.sin(t * 1.8 + b.bobPhase) * 0.02;
        groupRef.current.scale.set(scale, scale, scale);
        break;
      }

      case 'pausing-at-waypoint': {
        // Decelerate to stop
        b.vx *= 0.92;
        b.vz *= 0.92;
        b.px += b.vx * dt;
        b.pz += b.vz * dt;

        groupRef.current.position.x = b.px;
        groupRef.current.position.z = b.pz;
        // Subtle weight-shifting while paused
        const shiftX = Math.sin(t * 0.3 + b.bobPhase) * 0.004;
        const shiftZ = Math.cos(t * 0.25 + b.bobPhase * 1.3) * 0.003;
        groupRef.current.position.x += shiftX;
        groupRef.current.position.z += shiftZ;
        groupRef.current.position.y = Math.sin(t * 0.8 + b.bobPhase) * 0.004;
        // Slow look-around
        b.targetRotY += Math.sin(t * 0.3 + b.bobPhase) * 0.001;
        b.currentRotY = THREE.MathUtils.lerp(b.currentRotY, b.targetRotY, 0.02);
        groupRef.current.rotation.y = b.currentRotY;
        groupRef.current.rotation.x = Math.sin(t * 0.4 + b.bobPhase) * 0.008;
        groupRef.current.rotation.z = Math.sin(t * 0.35 + b.bobPhase * 0.7) * 0.006;
        const pauseBreathe = 1 + Math.sin(t * 0.9 + b.bobPhase) * 0.003;
        groupRef.current.scale.set(scale * pauseBreathe, scale * pauseBreathe, scale * pauseBreathe);

        // Transition when pause ends
        if (b.stateTimer >= b.pauseDuration) {
          if (status === 'roaming' && roamWaypoints.length > 0) {
            pickNextWaypoint();
          } else {
            startWalkTo(b.homeX, b.homeZ, 'returning-to-desk');
          }
        }
        break;
      }
    }

    // Write position to shared array
    if (sharedPositions) {
      sharedPositions[agentIndex * 2] = b.px;
      sharedPositions[agentIndex * 2 + 1] = b.pz;
    }

    // Write internal state to shared array
    if (sharedInternalStates) {
      sharedInternalStates[agentIndex] = INTERNAL_STATE_CODES[b.internalState];
    }

    // Track divider side
    if (collisionData) {
      if (b.px < collisionData.divider.x) b.lastSideOfDivider = -1;
      else b.lastSideOfDivider = 1;
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
