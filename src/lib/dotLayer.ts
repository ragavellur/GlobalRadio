import type { City } from '../types';
import { createDotRenderer, type DotRenderer } from './dotRenderer';

let renderer: DotRenderer | null = null;

export function createDotLayer(cities: City[], onCityClick: (city: City) => void) {
  return {
    id: 'radio-dots',
    type: 'custom' as const,
    renderingMode: '3d' as const,

    onAdd: function (_map: any, gl: WebGLRenderingContext) {
      renderer = createDotRenderer();
      renderer.setData(cities);
    },

    render: function (gl: WebGLRenderingContext, args: { matrix: any }) {
      if (!renderer || !args.matrix) return;

      const map = this as any;
      const zoom = map.getZoom ? map.getZoom() : 1.5;
      const globalScale = Math.pow(2, zoom) * 0.5;

      const matrix = args.matrix instanceof Float32Array
        ? args.matrix
        : new Float32Array(args.matrix);

      renderer.render(gl, matrix, globalScale);
    },

    onRemove: function () {
      if (renderer) {
        renderer.destroy();
        renderer = null;
      }
    },

    setHighlight: function (cityId: number | null) {
      if (renderer) {
        renderer.setHighlight(cityId);
      }
    },

    getRenderer: function () {
      return renderer;
    },
  };
}
