import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth } from "@mariozechner/pi-tui";

export class PrefixBlock implements Component {
  constructor(
    private readonly body: Component,
    private readonly prefix: string,
  ) {}

  render(width: number): string[] {
    const requestedWidth = Math.max(1, Math.floor(width));
    const prefixWidth = visibleWidth(this.prefix);
    const bodyWidth = Math.max(1, requestedWidth - prefixWidth);
    const bodyLines = this.body.render(bodyWidth);
    const content = bodyLines.length > 0 ? bodyLines : [""];
    const indent = " ".repeat(prefixWidth);

    return content.map((line, index) => `${index === 0 ? this.prefix : indent}${line}`);
  }

  invalidate(): void {
    this.body.invalidate();
  }
}
