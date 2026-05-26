import { Container, Spacer } from "@mariozechner/pi-tui";
import { markdownTheme, theme } from "../theme/theme.js";
import { HyperlinkMarkdown } from "./hyperlink-markdown.js";
import { PrefixBlock } from "./prefix-block.js";

export class UserMessageComponent extends Container {
  private body: HyperlinkMarkdown;

  constructor(text: string) {
    super();
    this.body = new HyperlinkMarkdown(text, 0, 0, markdownTheme, {
      color: (line) => theme.userText(line),
    });
    this.addChild(new Spacer(1));
    this.addChild(new PrefixBlock(this.body, theme.userPrompt("❯ ")));
  }

  setText(text: string) {
    this.body.setText(text);
  }
}
