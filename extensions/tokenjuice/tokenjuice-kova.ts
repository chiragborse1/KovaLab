declare module "tokenjuice/openclaw" {
  type KovaPiRuntime = {
    on(event: string, handler: (event: unknown, ctx: { cwd: string }) => unknown): void;
  };

  export function createTokenjuiceOpenClawEmbeddedExtension(): (pi: KovaPiRuntime) => void;
}
