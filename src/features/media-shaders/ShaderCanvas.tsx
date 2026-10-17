import { useEffect, useRef, useState } from "react";
import { cn } from "@/core/lib/utils";
import {
  compileISF,
  applyISFUniforms,
  parseISFBackground,
  resolveISFSource,
  type ISFProgramBundle,
} from "./isfEngine";

export interface ShaderCanvasProps {
  shader?: string;
  inputs?: Record<string, any>;
  className?: string;
  onError?: (err: string | null) => void;
}

export function ShaderCanvas({
  shader = "plasma",
  inputs: externalInputs,
  className,
  onError,
}: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [compileError, setCompileError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
      }) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) {
      const err = "WebGL não é suportado neste navegador/ambiente.";
      setCompileError(err);
      onError?.(err);
      return;
    }

    const data = parseISFBackground(shader);
    const source = resolveISFSource(data);
    const effectiveInputs = {
      ...(data.inputs ?? {}),
      ...(externalInputs ?? {}),
    };

    const compilation = compileISF(gl, source);
    if (compilation.error || !compilation.bundle) {
      setCompileError(compilation.error ?? "Erro ao compilar shader");
      onError?.(compilation.error ?? "Erro ao compilar shader");
      return;
    }

    setCompileError(null);
    onError?.(null);

    const bundle: ISFProgramBundle = compilation.bundle;

    // Buffer de tela cheia (quad de 2 triângulos)
    const buffer = gl.createBuffer();
    if (!buffer) return;

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

      const cw = Math.max(1, canvas.clientWidth);
      const ch = Math.max(1, canvas.clientHeight);

      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        gl.viewport(0, 0, cw, ch);
      }

      gl.useProgram(bundle.program);
      gl.enableVertexAttribArray(bundle.positionLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(bundle.positionLoc, 2, gl.FLOAT, false, 0, 0);

      const elapsed = (performance.now() - startTime) / 1000;
      applyISFUniforms(gl, bundle, effectiveInputs, elapsed, cw, ch);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    }

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (gl) {
        gl.deleteProgram(bundle.program);
        gl.deleteBuffer(buffer);
      }
    };
  }, [shader, externalInputs, onError]);

  if (compileError) {
    return (
      <div className={cn("size-full flex items-center justify-center bg-zinc-950 p-2 text-center", className)}>
        <p className="font-mono text-[10px] text-destructive line-clamp-3">
          Shader error: {compileError}
        </p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn("size-full block absolute inset-0 pointer-events-none", className)}
    />
  );
}
export { ISF_PRESETS } from "./isfEngine";
