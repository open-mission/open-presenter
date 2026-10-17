import { useEffect, useRef } from "react";

export type ShaderPreset = "plasma" | "aurora" | "particles" | "gradient-wave";

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADERS: Record<string, string> = {
  plasma: `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.35;
  float v1 = sin(p.x * 2.5 + t);
  float v2 = sin(p.y * 3.0 - t * 0.8);
  float v3 = sin((p.x + p.y) * 2.0 + t * 1.2);
  float v4 = sin(length(p) * 3.5 - t);
  float v = (v1 + v2 + v3 + v4) * 0.25;
  vec3 col = 0.5 + 0.5 * cos(v * 4.0 + vec3(0.1, 0.4, 0.9) + vec3(0.0, 0.5, 1.0));
  col = mix(vec3(0.02, 0.04, 0.1), col, 0.55);
  gl_FragColor = vec4(col, 1.0);
}
`,
  aurora: `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.3;
  float wave1 = sin(uv.x * 4.0 + t) * 0.2 + 0.5;
  float wave2 = sin(uv.x * 6.0 - t * 0.7) * 0.15 + 0.45;
  float dist1 = 1.0 - smoothstep(0.0, 0.25, abs(uv.y - wave1));
  float dist2 = 1.0 - smoothstep(0.0, 0.3, abs(uv.y - wave2));
  vec3 col1 = vec3(0.05, 0.6, 0.5) * dist1;
  vec3 col2 = vec3(0.3, 0.1, 0.7) * dist2;
  vec3 base = vec3(0.02, 0.02, 0.06);
  gl_FragColor = vec4(base + col1 + col2, 1.0);
}
`,
  particles: `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.2;
  vec3 col = vec3(0.01, 0.02, 0.05);
  for (float i = 0.0; i < 30.0; i++) {
    vec2 pos = vec2(sin(i * 1.5 + t * (0.3 + hash(vec2(i, 0.0)) * 0.3)), cos(i * 2.1 + t * 0.4)) * 0.8;
    float dist = length(uv - pos);
    float glow = 0.015 / (dist + 0.01);
    vec3 pcol = mix(vec3(0.3, 0.6, 1.0), vec3(0.9, 0.5, 0.2), hash(vec2(i, 1.0)));
    col += pcol * glow * 0.4;
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
  "gradient-wave": `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.4;
  float c = sin(uv.x * 3.0 + t) + cos(uv.y * 3.0 - t * 0.5);
  vec3 col = mix(vec3(0.1, 0.05, 0.25), vec3(0.05, 0.25, 0.4), c * 0.5 + 0.5);
  col += vec3(0.1, 0.02, 0.15) * sin(uv.y * 8.0 + t);
  gl_FragColor = vec4(col, 1.0);
}
`,
};

export const SHADER_PRESETS: { id: ShaderPreset; name: string; desc: string }[] = [
  { id: "plasma", name: "Plasma Fluido", desc: "Fluxo dinâmico de gradientes em movimento" },
  { id: "aurora", name: "Aurora Boreal", desc: "Ondulações suaves de luz verde e roxa" },
  { id: "particles", name: "Nebulosa Cósmica", desc: "Partículas luminosas flutuantes" },
  { id: "gradient-wave", name: "Ondas Modernas", desc: "Malha suave de cores líquidas" },
];

export function ShaderCanvas({
  shader = "plasma",
  className,
}: {
  shader?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return;

    let fragSource = FRAGMENT_SHADERS[shader] || FRAGMENT_SHADERS.plasma;
    if (shader.includes("void main")) {
      fragSource = shader;
    }

    function createShader(type: number, src: string): WebGLShader | null {
      if (!gl) return null;
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    const vs = createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl.FRAGMENT_SHADER, fragSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return;
    }

    const positionLoc = gl.getAttribLocation(program, "position");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const resLoc = gl.getUniformLocation(program, "u_resolution");

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    let animationFrameId: number;
    const startTime = performance.now();

    function render() {
      if (!gl || !canvas) return;
      if (
        canvas.width !== canvas.clientWidth ||
        canvas.height !== canvas.clientHeight
      ) {
        canvas.width = Math.max(1, canvas.clientWidth);
        canvas.height = Math.max(1, canvas.clientHeight);
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      gl.useProgram(program);
      gl.enableVertexAttribArray(positionLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      const elapsed = (performance.now() - startTime) / 1000;
      if (timeLoc) gl.uniform1f(timeLoc, elapsed);
      if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    }

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (gl) {
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteBuffer(buffer);
      }
    };
  }, [shader]);

  return (
    <canvas
      ref={canvasRef}
      className={`size-full block ${className ?? ""}`}
    />
  );
}
