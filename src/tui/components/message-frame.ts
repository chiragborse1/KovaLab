import type { Component } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

export interface MessageFrameTheme {
  border: (text: string) => string;
  title: (text: string) => string;
}

export interface MessageFrameOptions {
  title: string;
  theme: MessageFrameTheme;
}

const MIN_FRAME_WIDTH = 10;

function padToWidth(line: string, width: number): string {
  const clipped = truncateToWidth(line, width, "…");
  return clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
}

export class MessageFrame implements Component {
  constructor(
    private readonly body: Component,
    private readonly options: MessageFrameOptions,
  ) {}

  render(width: number): string[] {
    const requestedWidth = Math.max(1, Math.floor(width));
    if (requestedWidth < MIN_FRAME_WIDTH) {
      return this.body.render(requestedWidth);
    }
    const frameWidth = requestedWidth;
    const innerWidth = Math.max(1, frameWidth - 2);
    const bodyLines = this.body.render(innerWidth);
    const content = bodyLines.length > 0 ? bodyLines : [""];

    return [
      this.renderTop(frameWidth),
      ...content.map((line) => this.renderContentLine(line, innerWidth)),
    ];
  }

  invalidate(): void {
    this.body.invalidate();
  }

  private renderTop(width: number): string {
    const maxTitleWidth = Math.max(1, width - 7);
    const title = truncateToWidth(this.options.title, maxTitleWidth, "…");
    const titleWidth = visibleWidth(title);
    const fillerWidth = Math.max(0, width - 4 - titleWidth);

    return [
      this.options.theme.border("╭─ "),
      this.options.theme.title(title),
      this.options.theme.border(` ${"─".repeat(fillerWidth)}`),
    ].join("");
  }

  private renderContentLine(line: string, innerWidth: number): string {
    return [this.options.theme.border("  "), padToWidth(line, innerWidth)].join("");
  }
}
