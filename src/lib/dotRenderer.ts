import type { City } from '../types';

const DOT_COLOR = [0, 1, 0.51]; // #00FF82
const DOT_COLOR_HIGHLIGHT = [1, 1, 1]; // white
const HIGHLIGHT_RADIUS = 500; // km

const vertexShaderSource = `
  attribute vec2 a_position;
  attribute float a_size;
  attribute float a_brightness;

  uniform mat4 u_matrix;
  uniform float u_globalScale;

  varying float v_brightness;

  void main() {
    gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
    gl_PointSize = a_size * u_globalScale;
    v_brightness = a_brightness;
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  uniform vec3 u_color;
  uniform vec3 u_highlightColor;

  varying float v_brightness;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    if (dist > 0.5) discard;

    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    vec3 color = mix(u_color, u_highlightColor, v_brightness);

    gl_FragColor = vec4(color, alpha);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export interface DotRenderer {
  setData: (cities: City[]) => void;
  setHighlight: (cityId: number | null) => void;
  render: (gl: WebGLRenderingContext, matrix: number[], globalScale: number) => void;
  destroy: () => void;
}

export function createDotRenderer(): DotRenderer {
  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let cities: City[] = [];
  let highlightedCityId: number | null = null;

  // Buffers
  let positionBuffer: WebGLBuffer | null = null;
  let sizeBuffer: WebGLBuffer | null = null;
  let brightnessBuffer: WebGLBuffer | null = null;

  // Attribute locations
  let positionLocation = 0;
  let sizeLocation = 0;
  let brightnessLocation = 0;

  // Uniform locations
  let matrixLocation: WebGLUniformLocation | null = null;
  let colorLocation: WebGLUniformLocation | null = null;
  let highlightColorLocation: WebGLUniformLocation | null = null;
  let globalScaleLocation: WebGLUniformLocation | null = null;

  function initBuffers() {
    if (!gl) return;

    positionBuffer = gl.createBuffer();
    sizeBuffer = gl.createBuffer();
    brightnessBuffer = gl.createBuffer();
  }

  function updateBuffers() {
    if (!gl || !positionBuffer || !sizeBuffer || !brightnessBuffer) return;

    const count = cities.length;
    const positions = new Float32Array(count * 2);
    const sizes = new Float32Array(count);
    const brightness = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const city = cities[i];
      // Convert lng/lat to Mercator coordinates (0-1 range for MapLibre matrix)
      const x = (city.lon + 180) / 360;
      const latRad = (city.lat * Math.PI) / 180;
      const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
      positions[i * 2] = x;
      positions[i * 2 + 1] = y;

      // Size based on station count
      const stationCount = city.stationCount || 1;
      if (stationCount > 50) {
        sizes[i] = 0.42; // largePlaceScale
      } else if (stationCount > 10) {
        sizes[i] = 0.27; // mediumPlaceScale
      } else {
        sizes[i] = 0.14; // smallPlaceScale
      }

      brightness[i] = 0.0;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, brightnessBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, brightness, gl.DYNAMIC_DRAW);
  }

  return {
    setData: (newCities: City[]) => {
      cities = newCities;
      updateBuffers();
    },

    setHighlight: (cityId: number | null) => {
      highlightedCityId = cityId;
      if (!gl || !brightnessBuffer) return;

      const brightness = new Float32Array(cities.length);
      for (let i = 0; i < cities.length; i++) {
        brightness[i] = cities[i].cityId === cityId ? 1.0 : 0.0;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, brightnessBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, brightness, gl.DYNAMIC_DRAW);
    },

    render: (glContext: WebGLRenderingContext, matrix: number[], globalScale: number) => {
      if (!cities.length) return;

      gl = glContext;

      if (!program) {
        program = createProgram(gl);
        if (!program) return;

        positionLocation = gl.getAttribLocation(program, 'a_position');
        sizeLocation = gl.getAttribLocation(program, 'a_size');
        brightnessLocation = gl.getAttribLocation(program, 'a_brightness');
        matrixLocation = gl.getUniformLocation(program, 'u_matrix');
        colorLocation = gl.getUniformLocation(program, 'u_color');
        highlightColorLocation = gl.getUniformLocation(program, 'u_highlightColor');
        globalScaleLocation = gl.getUniformLocation(program, 'u_globalScale');

        initBuffers();
        updateBuffers();
      }

      gl.useProgram(program);

      // Set uniforms
      gl.uniformMatrix4fv(matrixLocation, false, matrix);
      gl.uniform3fv(colorLocation, DOT_COLOR);
      gl.uniform3fv(highlightColorLocation, DOT_COLOR_HIGHLIGHT);
      gl.uniform1f(globalScaleLocation, globalScale);

      // Bind position buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      // Bind size buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.enableVertexAttribArray(sizeLocation);
      gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);

      // Bind brightness buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, brightnessBuffer);
      gl.enableVertexAttribArray(brightnessLocation);
      gl.vertexAttribPointer(brightnessLocation, 1, gl.FLOAT, false, 0, 0);

      // Enable blending for transparency
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Draw points
      gl.drawArrays(gl.POINTS, 0, cities.length);
    },

    destroy: () => {
      if (gl && program) {
        gl.deleteProgram(program);
        if (positionBuffer) gl.deleteBuffer(positionBuffer);
        if (sizeBuffer) gl.deleteBuffer(sizeBuffer);
        if (brightnessBuffer) gl.deleteBuffer(brightnessBuffer);
      }
      program = null;
      gl = null;
      cities = [];
    },
  };
}
