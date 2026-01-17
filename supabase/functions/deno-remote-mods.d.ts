// Minimal module declarations for Deno remote std imports used by Supabase functions
// This prevents the TS server from complaining with TS2307 "Cannot find module 'https://deno.land/...'

declare module "https://deno.land/std@0.177.0/http/server.ts" {
  // Minimal typing for `serve` used in our functions
  export function serve(handler: (req: Request) => Response | Promise<Response>, options?: any): void;
}

// Fallback wildcard for other std modules (keeps types permissive)
declare module "https://deno.land/std@0.177.0/*" {
  const mod: any;
  export default mod;
}

// Broad catch-all (only if above patterns still fail)
declare module "https://deno.land/*" {
  const mod: any;
  export default mod;
}
