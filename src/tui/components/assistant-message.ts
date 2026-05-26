import { Container, Spacer } from "@mariozechner/pi-tui";
import { markdownTheme, theme } from "../theme/theme.js";
import { HyperlinkMarkdown } from "./hyperlink-markdown.js";
import { PrefixBlock } from "./prefix-block.js";

export class AssistantMessageComponent extends Container {
  private body: HyperlinkMarkdown;
  private block: PrefixBlock;

  constructor(text: string) {
    super();
    this.body = new HyperlinkMarkdown(text, 0, 0, markdownTheme, {
      // Keep assistant body text in terminal default foreground so contrast
      // follows the user's terminal theme (dark or light).
      color: (line) => theme.assistantText(line),
    });
    this.block = new PrefixBlock(this.body, theme.assistantPrompt("● "));
    this.addChild(new Spacer(1));
    this.addChild(this.block);
  }

  setText(text: string) {
    this.body.setText(text);
  }
}
