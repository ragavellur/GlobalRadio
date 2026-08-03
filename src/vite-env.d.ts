/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SONOS_CLIENT_ID?: string;
  readonly VITE_SONOS_REDIRECT_URI?: string;
  readonly VITE_SONOS_FUNCTION_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'maplibre-gl/dist/maplibre-gl.css' {
  const content: string;
  export default content;
}
