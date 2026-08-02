import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const DESKTOP_PARTICLE_COUNT = 4_800;
const REDUCED_PARTICLE_COUNT = 1_100;
const LOW_END_CORE_COUNT = 4;
const MOBILE_BREAKPOINT = 768;
const MAX_PIXEL_RATIO = 1.5;
const CURSOR_RADIUS = 180;
const FIELD_SCALE = 1.24;

export interface MigrationCoreCanvasHandle {
  pulse: () => void;
  setPointer: (x: number, y: number) => void;
}

export interface MigrationCoreCanvasProps {
  onReady: (ready: boolean) => void;
  reduceMotion: boolean | null;
}

const fieldVertexShader = `#version 300 es
precision highp float;

const vec2 positions[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));

void main() {
  gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
}`;

const fieldFragmentShader = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uActivity;
uniform float uPulse;
uniform float uTime;

out vec4 outColor;

mat2 rotate(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  return mix(
    mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), local.x),
    local.y
  );
}

float fbm(vec2 point) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 3; octave++) {
    value += amplitude * valueNoise(point);
    point = rotate(0.56) * point * 2.03 + vec2(13.7, 7.1);
    amplitude *= 0.5;
  }
  return value / 0.875;
}

float ellipseRing(vec2 point, float radius, float thickness, float scaleY, float rotation) {
  vec2 warped = rotate(rotation) * point;
  warped.y *= scaleY;
  return 1.0 - smoothstep(0.0, thickness, abs(length(warped) - radius));
}

float arcMask(float angle, float center, float width) {
  return smoothstep(cos(width), 1.0, cos(angle - center));
}

void main() {
  vec2 point = ((gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y) * 1.24;
  float distanceToPointer = length(point - uPointer);
  float pull = exp(-distanceToPointer * 5.0) * 0.012 * (1.0 + uActivity * 0.15);
  point -= normalize(point + vec2(0.0001)) * pull;

  float radius = length(point);
  vec2 diskPoint = rotate(-0.13) * point;
  diskPoint.y *= 1.12;
  float diskRadius = length(diskPoint);
  float angle = atan(diskPoint.y, diskPoint.x);

  // Three octaves make the plasma's edge physically irregular instead of sinusoidal.
  float turbulence = fbm(vec2(angle * 2.6 + uTime * 0.014, diskRadius * 14.0 - uTime * 0.022));
  float fineTurbulence = fbm(vec2(angle * 6.0 - uTime * 0.019, diskRadius * 27.0 + 5.0));
  float ringCenter = 0.158 + (turbulence - 0.5) * 0.012 + (fineTurbulence - 0.5) * 0.004;
  float ringWidth = 0.0068 + turbulence * 0.0092;
  float ringDistance = diskRadius - ringCenter;
  float plasmaBand = exp(-pow(ringDistance / ringWidth, 2.0));

  vec2 lightDirection = normalize(vec2(-0.62, 0.78));
  float directionalLight = 0.64 + 0.36 * smoothstep(-0.72, 0.84, dot(normalize(diskPoint + vec2(0.0001)), lightDirection));
  float hotspots = 0.0;
  hotspots += arcMask(angle, -2.25 + uTime * 0.43, 0.08);
  hotspots += arcMask(angle, -0.92 - uTime * 0.35, 0.105);
  hotspots += arcMask(angle, 0.47 + uTime * 0.49, 0.075);
  hotspots += arcMask(angle, 2.08 - uTime * 0.41, 0.095);
  float plasmaEnergy = plasmaBand * (directionalLight + min(hotspots, 1.0) * 0.56);

  // Power-law falloff prevents the core glow from looking like a CSS sticker.
  float powerGlow = min(0.19, 0.00007 / (ringDistance * ringDistance + 0.00055));
  powerGlow *= 0.56 + directionalLight * 0.44;
  float wispOne = arcMask(angle, -1.84 + uTime * 0.13, 0.38) * exp(-pow((ringDistance - 0.026) * 62.0, 2.0)) * 0.18;
  float wispTwo = arcMask(angle, 0.34 - uTime * 0.11, 0.3) * exp(-pow((ringDistance - 0.021) * 70.0, 2.0)) * 0.14;
  float wispThree = arcMask(angle, 2.64 + uTime * 0.09, 0.28) * exp(-pow((ringDistance + 0.018) * 74.0, 2.0)) * 0.12;
  float wisps = wispOne + wispTwo + wispThree;

  float orbitOne = ellipseRing(point, 0.31 * (1.0 + sin(uTime * 0.79) * 0.02) * (1.0 + uActivity * 0.03), 0.0012, 2.15, -0.27 + uTime * 0.013);
  float orbitTwo = ellipseRing(point, 0.41 * (1.0 + sin(uTime * 0.63 + 1.4) * 0.018) * (1.0 + uActivity * 0.024), 0.0009, 1.56, 0.52 - uTime * 0.009);
  float orbitThree = ellipseRing(point, 0.53 * (1.0 + sin(uTime * 1.02 + 2.1) * 0.016) * (1.0 + uActivity * 0.02), 0.0007, 2.65, -0.68 + uTime * 0.016);
  float orbitStrength = orbitOne * 0.18 + orbitTwo * 0.1 + orbitThree * 0.055;

  vec2 dustCell = floor((point + 1.2) * 56.0);
  vec2 dustLocal = fract((point + 1.2) * 56.0) - 0.5;
  float dustRange = smoothstep(0.12, 0.16, diskRadius) * (1.0 - smoothstep(0.3, 0.36, diskRadius));
  float dust = step(0.996, hash(dustCell)) * smoothstep(0.055, 0.0, length(dustLocal)) * dustRange;

  float core = 1.0 - smoothstep(0.082, 0.09, radius);
  float lens = exp(-pow((radius - 0.103) * 36.0, 2.0)) * 0.13;
  float pulse = uPulse * exp(-radius * 8.0) * 0.12;
  float energy = (plasmaEnergy + powerGlow + wisps + lens + pulse) * (1.0 + uActivity * 0.1);

  vec3 deepSpace = vec3(0.009, 0.011, 0.016);
  vec3 ember = vec3(1.0, 0.18, 0.07);
  vec3 amber = vec3(1.0, 0.48, 0.17);
  vec3 whiteHot = vec3(1.0, 0.9, 0.7);
  vec3 cool = vec3(0.22, 0.42, 0.7);
  vec3 plasma = mix(ember, amber, smoothstep(0.08, 0.56, plasmaBand));
  plasma = mix(plasma, whiteHot, pow(plasmaBand, 3.1) * directionalLight);
  plasma += whiteHot * min(hotspots, 1.0) * 0.22;

  vec3 color = plasma * energy + cool * orbitStrength + amber * dust * 0.22;
  vec3 coreShade = vec3(0.0015, 0.0018, 0.0025) + vec3(fbm(point * 15.0) * 0.003);
  color = mix(color, coreShade, core);
  float alpha = max(max(energy * 0.84, orbitStrength), dust * 0.13);
  alpha = max(alpha, core * 0.99);
  outColor = vec4(color, alpha);
}`;

const particleVertexShader = `#version 300 es
precision highp float;

layout(location = 0) in vec4 aParticle;
layout(location = 1) in vec3 aMeta;

uniform float uAspect;
uniform float uActivity;
uniform float uMotion;
uniform vec2 uPointer;
uniform vec2 uResolution;
uniform float uTime;

out vec3 vColor;
out float vAlpha;
out float vSoftness;
out vec2 vUv;

vec2 cornerForVertex(int index) {
  if (index == 0) return vec2(-1.0, -1.0);
  if (index == 1) return vec2(1.0, -1.0);
  if (index == 2) return vec2(-1.0, 1.0);
  if (index == 3) return vec2(-1.0, 1.0);
  if (index == 4) return vec2(1.0, -1.0);
  return vec2(1.0, 1.0);
}

vec2 connectionSource(float route, float aspect) {
  if (route < 1.5) return vec2(0.76 * aspect, 0.66);
  if (route < 2.5) return vec2(-0.7 * aspect, 0.16);
  if (route < 3.5) return vec2(0.74 * aspect, -0.4);
  return vec2(0.4 * aspect, -0.76);
}

void main() {
  float angle = aParticle.x;
  float seed = aParticle.z;
  float outgoing = step(0.5, aParticle.w);
  float route = aMeta.x;
  float depth = aMeta.y;
  float ejection = aMeta.z;
  float phase = fract(uTime * (0.026 + seed * 0.036) * (uMotion + ejection * uActivity * 0.05) + aParticle.y);
  vec2 position;

  if (route > 0.5) {
    vec2 source = connectionSource(route, uAspect);
    vec2 target = normalize(source) * 0.11;
    float progress = smoothstep(0.04, 0.96, phase);
    vec2 normal = normalize(vec2(-source.y, source.x));
    float bend = sin(progress * 3.14159 + seed * 6.28318) * (0.035 + seed * 0.045);
    position = mix(source, target, progress) + normal * bend * sin(progress * 3.14159);
  } else {
    float incomingRadius = mix(0.66, 0.11, phase);
    float outgoingRadius = mix(0.12, 0.62, phase);
    float radius = mix(incomingRadius, outgoingRadius, outgoing);
    radius += ejection * smoothstep(0.56, 0.74, phase) * (1.0 - smoothstep(0.78, 0.96, phase)) * 0.24;
    float rotation = angle + uTime * (0.032 + seed * 0.03) * uMotion + phase * (1.15 + seed * 0.72);
    position = vec2(cos(rotation), sin(rotation) * 0.62) * radius;
  }

  float pointerDistance = length(position - uPointer);
  position += normalize(position - uPointer + vec2(0.0001)) * exp(-pointerDistance * 4.8) * 0.01;

  float fade = smoothstep(0.025, 0.13, phase) * (1.0 - smoothstep(0.76, 0.98, phase));
  if (route > 0.5) fade = smoothstep(0.02, 0.14, phase) * (1.0 - smoothstep(0.84, 0.99, phase));
  float flicker = 0.8 + 0.2 * sin(uTime * (1.05 + seed * 2.1) + seed * 47.0);
  float depthFade = depth < 0.5 ? 0.52 : (depth < 1.5 ? 0.76 : 1.0);
  vAlpha = fade * (0.15 + seed * 0.2) * flicker * depthFade;
  vColor = mix(vec3(1.0, 0.24, 0.09), vec3(1.0, 0.78, 0.46), seed);
  vColor = mix(vColor, vec3(0.31, 0.56, 0.86), step(0.94, seed) * (1.0 - step(0.5, route)));

  float pointSize = depth < 0.5 ? mix(0.55, 1.45, seed) : (depth < 1.5 ? mix(0.9, 1.9, seed) : mix(1.2, 2.65, seed));
  if (route > 0.5) pointSize *= 1.08;
  vec2 corner = cornerForVertex(gl_VertexID);
  vec2 offset = corner * pointSize / uResolution;
  gl_Position = vec4(vec2(position.x / uAspect, position.y) + offset, -0.45 + depth * 0.24, 1.0);
  vSoftness = depth < 0.5 ? 0.88 : (depth < 1.5 ? 0.76 : 0.66);
  vUv = corner * 0.5 + 0.5;
}`;

const particleFragmentShader = `#version 300 es
precision highp float;

in vec3 vColor;
in float vAlpha;
in float vSoftness;
in vec2 vUv;

out vec4 outColor;

void main() {
  float falloff = smoothstep(vSoftness, 0.0, length(vUv - 0.5));
  outColor = vec4(vColor * falloff, vAlpha * falloff);
}`;

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string) {
  const compileShader = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to create shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader error.';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create WebGL program.');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown program link error.';
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function seededValue(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function getParticleCount() {
  const device = navigator as Navigator & { deviceMemory?: number };
  const lowEndDevice = (device.hardwareConcurrency ?? 8) <= LOW_END_CORE_COUNT || (device.deviceMemory ?? 8) < 4;
  return window.innerWidth < MOBILE_BREAKPOINT || lowEndDevice ? REDUCED_PARTICLE_COUNT : DESKTOP_PARTICLE_COUNT;
}

export const MigrationCoreCanvas = forwardRef<MigrationCoreCanvasHandle, MigrationCoreCanvasProps>(function MigrationCoreCanvas(
  { onReady, reduceMotion },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const pulseRef = useRef(0);

  useImperativeHandle(ref, () => ({
    pulse: () => {
      pulseRef.current = 1;
    },
    setPointer: (x, y) => {
      pointerRef.current = { x, y };
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'high-performance' });
    if (!gl) {
      onReady(false);
      return;
    }

    let frameId = 0;
    let width = 1;
    let height = 1;
    let activity = 0;
    let targetPointer = { x: 0, y: 0 };
    let smoothedPointer = { x: 0, y: 0 };
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    try {
      const fieldProgram = createProgram(gl, fieldVertexShader, fieldFragmentShader);
      const particleProgram = createProgram(gl, particleVertexShader, particleFragmentShader);
      const particleBuffer = gl.createBuffer();
      const particleVao = gl.createVertexArray();
      if (!particleBuffer || !particleVao) throw new Error('Unable to allocate particle buffers.');

      const particleCount = getParticleCount();
      const particleData = new Float32Array(particleCount * 7);
      for (let index = 0; index < particleCount; index += 1) {
        const offset = index * 7;
        particleData[offset] = seededValue(index, 1) * Math.PI * 2;
        particleData[offset + 1] = seededValue(index, 2);
        particleData[offset + 2] = seededValue(index, 3);
        particleData[offset + 3] = index % 5 === 0 ? 1 : 0;
        particleData[offset + 4] = index % 9 === 0 ? (index % 4) + 1 : 0;
        particleData[offset + 5] = index % 3;
        particleData[offset + 6] = index % 197 === 0 ? 1 : 0;
      }

      gl.bindVertexArray(particleVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 28, 0);
      gl.vertexAttribDivisor(0, 1);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 16);
      gl.vertexAttribDivisor(1, 1);
      gl.bindVertexArray(null);

      const fieldUniforms = {
        activity: gl.getUniformLocation(fieldProgram, 'uActivity'),
        pointer: gl.getUniformLocation(fieldProgram, 'uPointer'),
        pulse: gl.getUniformLocation(fieldProgram, 'uPulse'),
        resolution: gl.getUniformLocation(fieldProgram, 'uResolution'),
        time: gl.getUniformLocation(fieldProgram, 'uTime'),
      };
      const particleUniforms = {
        aspect: gl.getUniformLocation(particleProgram, 'uAspect'),
        activity: gl.getUniformLocation(particleProgram, 'uActivity'),
        motion: gl.getUniformLocation(particleProgram, 'uMotion'),
        pointer: gl.getUniformLocation(particleProgram, 'uPointer'),
        resolution: gl.getUniformLocation(particleProgram, 'uResolution'),
        time: gl.getUniformLocation(particleProgram, 'uTime'),
      };

      const resize = () => {
        const bounds = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        width = Math.max(1, Math.floor(bounds.width * ratio));
        height = Math.max(1, Math.floor(bounds.height * ratio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
      };

      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();
      onReady(true);

      const startedAt = performance.now();
      let previousFrame = startedAt;
      const render = (now: number) => {
        const delta = Math.min((now - previousFrame) / 1000, 0.05);
        previousFrame = now;
        targetPointer = pointerRef.current;
        smoothedPointer.x += (targetPointer.x - smoothedPointer.x) * 0.045;
        smoothedPointer.y += (targetPointer.y - smoothedPointer.y) * 0.045;
        const bounds = canvas.getBoundingClientRect();
        const cursorDistance = Math.hypot(targetPointer.x * bounds.width, targetPointer.y * bounds.height);
        const targetActivity = finePointer && !reduceMotion ? Math.max(0, 1 - cursorDistance / CURSOR_RADIUS) : 0;
        const responseTime = targetActivity > activity ? 0.25 : 0.6;
        activity += (targetActivity - activity) * (1 - Math.exp(-delta / responseTime));
        pulseRef.current *= 0.94;

        const time = reduceMotion ? 0 : (now - startedAt) / 1000;
        const aspect = width / height;
        const particlePointerX = smoothedPointer.x * aspect;
        const particlePointerY = -smoothedPointer.y;

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(fieldProgram);
        gl.uniform2f(fieldUniforms.resolution, width, height);
        gl.uniform2f(fieldUniforms.pointer, particlePointerX * FIELD_SCALE, particlePointerY * FIELD_SCALE);
        gl.uniform1f(fieldUniforms.activity, activity);
        gl.uniform1f(fieldUniforms.pulse, pulseRef.current);
        gl.uniform1f(fieldUniforms.time, time);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        if (!reduceMotion) {
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
          gl.useProgram(particleProgram);
          gl.uniform1f(particleUniforms.aspect, aspect);
          gl.uniform1f(particleUniforms.activity, activity);
          gl.uniform1f(particleUniforms.motion, 1 + activity * 0.15);
          gl.uniform2f(particleUniforms.pointer, particlePointerX, particlePointerY);
          gl.uniform2f(particleUniforms.resolution, width, height);
          gl.uniform1f(particleUniforms.time, time);
          gl.bindVertexArray(particleVao);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, particleCount);
          gl.bindVertexArray(null);
        }

        if (!reduceMotion) frameId = requestAnimationFrame(render);
      };

      if (reduceMotion) {
        render(startedAt);
      } else {
        frameId = requestAnimationFrame(render);
      }

      return () => {
        cancelAnimationFrame(frameId);
        observer.disconnect();
        gl.deleteBuffer(particleBuffer);
        gl.deleteVertexArray(particleVao);
        gl.deleteProgram(fieldProgram);
        gl.deleteProgram(particleProgram);
      };
    } catch {
      onReady(false);
      return undefined;
    }
  }, [onReady, reduceMotion]);

  return <canvas aria-hidden="true" className="migration-core-canvas" ref={canvasRef} />;
});
