/// <reference types="vite/client" />

interface Window {
  _env_?: {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_PUBLISHABLE_KEY?: string;
    VITE_SUPABASE_PROJECT_ID?: string;
  };
}
