import { Container, Spacer } from "@mariozechner/pi-tui";
import { markdownTheme, theme } from "../theme/theme.js";
import { HyperlinkMarkdown } from "./hyperlink-markdown.js";
import { MessageFrame } from "./message-frame.js";

export class AssistantMessageComponent extends Container {
  private body: HyperlinkMarkdown;
  private frame: MessageFrame;

  constructor(text: string) {
    super();
    this.body = new HyperlinkMarkdown(text, 0, 0, markdownTheme, {
      // Keep assistant body text in terminal default foreground so contrast
      // follows the user's terminal theme (dark or light).
      color: (line) => theme.assistantText(line),
    });
    this.frame = new MessageFrame(this.body, {
      title: "Kova",
      theme: {
        border: theme.assistantBorder,
        title: theme.assistantTitle,
      },
    });
    this.addChild(new Spacer(1));
    this.addChild(this.frame);
  }

  setText(text: string) {
    this.body.setText(text);
  }
}
