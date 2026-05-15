export type KovaPiCodingAgentSkillSourceAugmentation = never;

declare module "@mariozechner/pi-coding-agent" {
  interface Skill {
    // Kova relies on the source identifier returned by pi skill loaders.
    source: string;
  }
}
