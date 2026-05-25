import chalk, { Chalk } from "chalk";
import { KOVA_TERMINAL_PALETTE } from "./palette.js";

const hasForceColor =
  typeof process.env.FORCE_COLOR === "string" &&
  process.env.FORCE_COLOR.trim().length > 0 &&
  process.env.FORCE_COLOR.trim() !== "0";

const baseChalk = process.env.NO_COLOR && !hasForceColor ? new Chalk({ level: 0 }) : chalk;

const hex = (value: string) => baseChalk.hex(value);

export const theme = {
  accent: hex(KOVA_TERMINAL_PALETTE.accent),
  accentBright: hex(KOVA_TERMINAL_PALETTE.accentBright),
  accentDim: hex(KOVA_TERMINAL_PALETTE.accentDim),
  info: hex(KOVA_TERMINAL_PALETTE.info),
  success: hex(KOVA_TERMINAL_PALETTE.success),
  warn: hex(KOVA_TERMINAL_PALETTE.warn),
  error: hex(KOVA_TERMINAL_PALETTE.error),
  muted: hex(KOVA_TERMINAL_PALETTE.muted),
  heading: baseChalk.bold.hex(KOVA_TERMINAL_PALETTE.accent),
  command: hex(KOVA_TERMINAL_PALETTE.accentBright),
  option: hex(KOVA_TERMINAL_PALETTE.warn),
} as const;

export const isRich = () => baseChalk.level > 0;

export const colorize = (rich: boolean, color: (value: string) => string, value: string) =>
  rich ? color(value) : value;
