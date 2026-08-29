declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve: (
    handler: (request: Request) => Response | Promise<Response>,
  ) => void;
};

declare module 'npm:@supabase/supabase-js@2' {
  export function createClient(url: string, key: string, options?: Record<string, unknown>): any;
}

declare module 'npm:livekit-server-sdk@2' {
  export class AccessToken {
    constructor(apiKey: string, apiSecret: string, options: { identity: string; name: string; ttl: string });
    addGrant(grant: VideoGrant): void;
    toJwt(): Promise<string>;
  }

  export class VideoGrant {
    constructor(options: { room: string; roomJoin: boolean; canPublish: boolean; canSubscribe: boolean });
  }
}
