declare module "tokenjuice/kova" {
  type KovaPiRuntime = {
    on(event: string, handler: (event: unknown, ctx: { cwd: string }) => unknown): void;
  };

  export function createTokenjuiceKovaEmbeddedExtension(): (pi: KovaPiRuntime) => void;
}
