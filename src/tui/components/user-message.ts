import { Container, Spacer } from "@mariozechner/pi-tui";
import { markdownTheme, theme } from "../theme/theme.js";
import { HyperlinkMarkdown } from "./hyperlink-markdown.js";
import { MessageFrame } from "./message-frame.js";

export class UserMessageComponent extends Container {
  private body: HyperlinkMarkdown;

  constructor(text: string) {
    super();
    this.body = new HyperlinkMarkdown(text, 0, 0, markdownTheme, {
      color: (line) => theme.userText(line),
    });
    this.addChild(new Spacer(1));
    this.addChild(
      new MessageFrame(this.body, {
        title: "You",
        theme: {
          border: theme.userBorder,
          title: theme.userTitle,
        },
      }),
    );
  }

  setText(text: string) {
    this.body.setText(text);
  }
}
