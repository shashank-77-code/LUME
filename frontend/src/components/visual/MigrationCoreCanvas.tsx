/* eslint-disable react-hooks/immutability -- R3F animation mutates Three.js refs and uniforms per frame. */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';

const COLORS = {
  graphite: '#121214',
  primary: '#ff6a3d',
  secondary: '#ff8c5a',
  highlight: '#fff4e8',
  accent: '#00d8ff',
  glow: '#ff2a00',
} as const;

const DESKTOP_PARTICLE_COUNT = 1_500;
const REDUCED_PARTICLE_COUNT = 700;
const LOW_END_CORE_COUNT = 4;
const MOBILE_BREAKPOINT = 768;
const MAX_PIXEL_RATIO = 1.5;

export interface MigrationCoreCanvasHandle {
  pulse: () => void;
  setPointer: (x: number, y: number) => void;
}

export interface MigrationCoreCanvasProps {
  onReady: (ready: boolean) => void;
  reduceMotion: boolean | null;
}

interface EngineRefs {
  pointer: MutableRefObject<{ x: number; y: number }>;
  pulse: MutableRefObject<number>;
}

interface RingSpec {
  radius: number;
  tube: number;
  speed: number;
  rotation: [number, number, number];
  opacity: number;
  isAccent: boolean;
  arc: number;
}

interface PacketSpec {
  radius: number;
  speed: number;
  axis: THREE.Vector3;
  angle: number;
}

const coreVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPositionNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const coreFragmentShader = `
  uniform vec3 colorPrimary;
  uniform vec3 colorSecondary;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPositionNormal;

  void main() {
    float fresnel = pow(clamp(1.0 - dot(vNormal, -vPositionNormal), 0.0, 1.0), 3.0);
    float pulse = sin(uTime * 2.0) * 0.1 + 0.9;
    vec3 finalColor = mix(colorSecondary, colorPrimary, fresnel);
    finalColor += vec3(1.0, 0.8, 0.6) * fresnel * 0.9 * pulse;
    float alpha = smoothstep(0.2, 1.0, fresnel) * 0.58;
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const particleVertexShader = `
  uniform float uTime;
  attribute vec3 randoms;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float angle = atan(pos.z, pos.x) + uTime * randoms.x;
    float radius = length(pos.xz);
    pos.x = cos(angle) * radius;
    pos.z = sin(angle) * radius;
    pos.y += sin(uTime + randoms.y) * 0.1;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = (3.0 / max(1.0, -mvPosition.z)) * (randoms.z * 1.5 + 0.5);
    vAlpha = randoms.z;
  }
`;

const particleFragmentShader = `
  uniform vec3 color;
  varying float vAlpha;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    if (distanceToCenter > 0.5) discard;
    float alpha = smoothstep(0.5, 0.1, distanceToCenter) * vAlpha * 0.6;
    gl_FragColor = vec4(color, alpha);
  }
`;

function seededValue(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function getParticleCount(reduceMotion: boolean) {
  if (reduceMotion) return 0;
  const device = navigator as Navigator & { deviceMemory?: number };
  const lowEndDevice =
    (device.hardwareConcurrency ?? 8) <= LOW_END_CORE_COUNT || (device.deviceMemory ?? 8) < 4;
  return window.innerWidth < MOBILE_BREAKPOINT || lowEndDevice
    ? REDUCED_PARTICLE_COUNT
    : DESKTOP_PARTICLE_COUNT;
}

function CentralCore() {
  const wireframeRef = useRef<THREE.Group>(null);
  const coreGeometry = useMemo(() => new THREE.IcosahedronGeometry(2.2, 2), []);
  const innerGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.8, 2), []);
  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(coreGeometry), [coreGeometry]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      colorPrimary: { value: new THREE.Color(COLORS.primary) },
      colorSecondary: { value: new THREE.Color(COLORS.glow) },
    }),
    [],
  );
  const shellMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: coreVertexShader,
        fragmentShader: coreFragmentShader,
        uniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [uniforms],
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    uniforms.uTime.value = time;
    if (wireframeRef.current) {
      wireframeRef.current.rotation.y = time * 0.05;
      wireframeRef.current.rotation.z = time * 0.02;
    }
  });

  return (
    <group>
      <pointLight color={COLORS.primary} intensity={12} distance={10} />
      <pointLight color={COLORS.highlight} intensity={3} distance={5} />
      <mesh geometry={coreGeometry}>
        <primitive object={shellMaterial} attach="material" />
      </mesh>
      <group ref={wireframeRef}>
        <mesh geometry={innerGeometry}>
          <meshBasicMaterial
            blending={THREE.AdditiveBlending}
            color={COLORS.secondary}
            opacity={0.15}
            transparent
            wireframe
          />
        </mesh>
        <points geometry={innerGeometry}>
          <pointsMaterial
            blending={THREE.AdditiveBlending}
            color={COLORS.highlight}
            opacity={0.8}
            size={0.04}
            sizeAttenuation
            transparent
          />
        </points>
      </group>
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial
          blending={THREE.AdditiveBlending}
          color={COLORS.primary}
          opacity={0.3}
          transparent
        />
      </lineSegments>
    </group>
  );
}

function GeometricFramework() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const time = clock.elapsedTime;
    groupRef.current.rotation.x = Math.sin(time * 0.1) * 0.2;
    groupRef.current.rotation.y = time * 0.03;
    const scale = 1 + Math.sin(time * 0.5) * 0.01;
    groupRef.current.scale.setScalar(scale);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <octahedronGeometry args={[3.2, 0]} />
        <meshBasicMaterial color={COLORS.secondary} opacity={0.08} transparent wireframe />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[3.8, 1]} />
        <meshBasicMaterial color={COLORS.graphite} opacity={0.3} transparent wireframe />
      </mesh>
    </group>
  );
}

function OrbitRings() {
  const groupRef = useRef<THREE.Group>(null);
  const rings = useMemo<RingSpec[]>(() => {
    const generated = Array.from({ length: 7 }, (_, index) => ({
      radius: 2.5 + seededValue(index, 11) * 2.5,
      tube: 0.002 + seededValue(index, 12) * 0.008,
      speed: (seededValue(index, 13) - 0.5) * 0.5,
      rotation: [seededValue(index, 14) * Math.PI, seededValue(index, 15) * Math.PI, 0] as [
        number,
        number,
        number,
      ],
      opacity: 0.1 + seededValue(index, 16) * 0.4,
      isAccent: seededValue(index, 17) > 0.85,
      arc: seededValue(index, 18) > 0.5 ? Math.PI * 2 : Math.PI * (1 + seededValue(index, 19)),
    }));

    generated.push({
      radius: 4.5,
      tube: 0.015,
      speed: 0.1,
      rotation: [Math.PI / 2.2, 0, Math.PI / 4],
      opacity: 0.8,
      isAccent: false,
      arc: Math.PI * 2,
    });
    return generated;
  }, []);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    groupRef.current?.children.forEach((ring, index) => {
      ring.rotation.z = time * rings[index].speed;
    });
  });

  return (
    <group ref={groupRef}>
      {rings.map((ring, index) => (
        <mesh key={index} rotation={ring.rotation}>
          <torusGeometry args={[ring.radius, ring.tube, 8, 96, ring.arc]} />
          <meshBasicMaterial
            blending={THREE.AdditiveBlending}
            color={ring.isAccent ? COLORS.accent : COLORS.primary}
            opacity={ring.opacity}
            side={THREE.DoubleSide}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function ParticleSystem({ reduceMotion }: { reduceMotion: boolean }) {
  const particleCount = useMemo(() => getParticleCount(reduceMotion), [reduceMotion]);
  const { positions, randoms } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const randoms = new Float32Array(particleCount * 3);

    for (let index = 0; index < particleCount; index += 1) {
      const radius = 1.5 + seededValue(index, 21) * 2.5;
      const angle = seededValue(index, 22) * Math.PI * 2;
      const verticalSpread = seededValue(index, 23) < 0.2 ? 3 : 0.5;
      const offset = index * 3;
      positions[offset] = Math.cos(angle) * radius;
      positions[offset + 1] = (seededValue(index, 24) - 0.5) * verticalSpread;
      positions[offset + 2] = Math.sin(angle) * radius;
      randoms[offset] = (seededValue(index, 25) - 0.5) * 0.5;
      randoms[offset + 1] = seededValue(index, 26) * Math.PI * 2;
      randoms[offset + 2] = seededValue(index, 27);
    }

    return { positions, randoms };
  }, [particleCount]);
  const geometry = useMemo(() => {
    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    nextGeometry.setAttribute('randoms', new THREE.BufferAttribute(randoms, 3));
    return nextGeometry;
  }, [positions, randoms]);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, color: { value: new THREE.Color(COLORS.secondary) } }),
    [],
  );
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );
  const dataPackets = useMemo<PacketSpec[]>(
    () =>
      Array.from({ length: 6 }, (_, index) => ({
        radius: 2.5 + seededValue(index, 31) * 2,
        speed: 0.5 + seededValue(index, 32) * 1.5,
        axis: new THREE.Vector3(
          seededValue(index, 33) - 0.5,
          seededValue(index, 34) - 0.5,
          seededValue(index, 35) - 0.5,
        ).normalize(),
        angle: seededValue(index, 36) * Math.PI * 2,
      })),
    [],
  );
  const packetAngles = useRef(dataPackets.map((packet) => packet.angle));
  const packetsRef = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    uniforms.uTime.value = clock.elapsedTime;
    packetsRef.current?.children.forEach((packet, index) => {
      const data = dataPackets[index];
      packetAngles.current[index] += delta * data.speed;
      const angle = packetAngles.current[index];
      packet.position.set(Math.cos(angle) * data.radius, 0, Math.sin(angle) * data.radius);
      packet.position.applyAxisAngle(data.axis, 1);
    });
  });

  return (
    <group>
      <points>
        <primitive object={geometry} attach="geometry" />
        <primitive object={material} attach="material" />
      </points>
      <group ref={packetsRef}>
        {dataPackets.map((_, index) => (
          <mesh key={index}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial
              blending={THREE.AdditiveBlending}
              color={COLORS.highlight}
              opacity={0.9}
              transparent
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function BackgroundAndOverlay() {
  const ticks = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 72;
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const radius = index % 12 === 0 ? 5.2 : 5.4;
      const outerRadius = 5.5;
      points.push(
        new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0),
        new THREE.Vector3(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius, 0),
      );
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);
  return (
    <group position={[0, 0, -2]}>
      <lineSegments geometry={ticks}>
        <lineBasicMaterial color={COLORS.highlight} opacity={0.05} transparent />
      </lineSegments>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[5.6, 5.61, 64, 1, 0, Math.PI / 2]} />
        <meshBasicMaterial
          color={COLORS.primary}
          opacity={0.2}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
      <mesh rotation={[0, 0, Math.PI + Math.PI / 4]}>
        <ringGeometry args={[5.6, 5.61, 64, 1, 0, Math.PI / 2]} />
        <meshBasicMaterial
          color={COLORS.primary}
          opacity={0.2}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
    </group>
  );
}

function Scene({ reduceMotion, refs, onReady }: { reduceMotion: boolean; refs: EngineRefs; onReady: (ready: boolean) => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const pointer = useRef(new THREE.Vector2());
  const targetPointer = useRef(new THREE.Vector2());
  const activity = useRef(0);

  useEffect(() => {
    onReady(true);
    return () => onReady(false);
  }, [onReady]);

  useFrame(({ clock }, delta) => {
    const time = reduceMotion ? 0 : clock.elapsedTime;
    targetPointer.current.set(refs.pointer.current.x, -refs.pointer.current.y);
    pointer.current.lerp(targetPointer.current, 1 - Math.exp(-delta * 6));
    const distance = pointer.current.length();
    const targetActivity = reduceMotion ? 0 : Math.max(0, 1 - distance / 0.42);
    activity.current = THREE.MathUtils.damp(activity.current, targetActivity, 5, delta);
    refs.pulse.current = THREE.MathUtils.damp(refs.pulse.current, 0, 4.5, delta);

    if (groupRef.current) {
      groupRef.current.scale.setScalar(1 + activity.current * 0.012);
      groupRef.current.position.x = THREE.MathUtils.damp(
        groupRef.current.position.x,
        Math.min(1.35, viewport.width * 0.16) + pointer.current.x * 0.28,
        3.5,
        delta,
      );
      groupRef.current.position.y = THREE.MathUtils.damp(
        groupRef.current.position.y,
        Math.sin(time * 0.2) * 0.1 + pointer.current.y * 0.14,
        3.5,
        delta,
      );
      groupRef.current.rotation.x = THREE.MathUtils.damp(
        groupRef.current.rotation.x,
        Math.sin(time * 0.1) * 0.05 + pointer.current.y * 0.04,
        3.5,
        delta,
      );
    }
  });

  return (
    <group ref={groupRef}>
      <CentralCore />
      <GeometricFramework />
      <OrbitRings />
      <ParticleSystem reduceMotion={reduceMotion} />
      <BackgroundAndOverlay />
    </group>
  );
}

export const MigrationCoreCanvas = forwardRef<MigrationCoreCanvasHandle, MigrationCoreCanvasProps>(
  function MigrationCoreCanvas({ onReady, reduceMotion }, ref) {
    const pointerRef = useRef({ x: 0, y: 0 });
    const pulseRef = useRef(0);
    const shouldReduceMotion = reduceMotion ?? false;

    useImperativeHandle(ref, () => ({
      pulse: () => {
        pulseRef.current = 1;
      },
      setPointer: (x, y) => {
        pointerRef.current = { x, y };
      },
    }));

    return (
      <Canvas
        aria-hidden="true"
        camera={{ far: 1000, fov: 35, near: 0.1, position: [0, 0, 14] }}
        className="migration-core-canvas"
        dpr={[1, MAX_PIXEL_RATIO]}
        frameloop={shouldReduceMotion ? 'demand' : 'always'}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        style={{
          height: '100%',
          inset: 0,
          pointerEvents: 'none',
          position: 'absolute',
          width: '100%',
        }}
      >
        <Scene
          onReady={onReady}
          refs={{ pointer: pointerRef, pulse: pulseRef }}
          reduceMotion={shouldReduceMotion}
        />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.42} luminanceSmoothing={0.42} luminanceThreshold={0.32} mipmapBlur />
        </EffectComposer>
      </Canvas>
    );
  },
);
