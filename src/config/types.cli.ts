export type CliBannerTaglineMode = "random" | "default" | "off";

export type CliConfig = {
  banner?: {
    /**
     * Controls CLI banner tagline behavior.
     * - "random": pick from the calm Kova tagline pool
     * - "default": always use the neutral default tagline
     * - "off": hide tagline text
     */
    taglineMode?: CliBannerTaglineMode;
  };
};
