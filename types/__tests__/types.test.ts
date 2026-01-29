import type {
  Message,
  Citation,
  ChatSession,
  Theme,
  TopicScope,
  TrustLevel,
} from "../index";

describe("Type definitions", () => {
  it("should allow creating a valid Message", () => {
    const message: Message = {
      id: "1",
      role: "user",
      content: "Hello",
      timestamp: new Date(),
    };

    expect(message.id).toBe("1");
    expect(message.role).toBe("user");
    expect(message.content).toBe("Hello");
  });

  it("should allow creating a valid Citation", () => {
    const citation: Citation = {
      id: "1",
      mdnUrl: "https://developer.mozilla.org/en-US/docs/Web/API",
      articleTitle: "Web APIs",
      excerpt: "Web APIs are...",
      lastUpdated: new Date(),
      trustLevel: "direct" as TrustLevel,
      relevanceScore: 0.95,
    };

    expect(citation.id).toBe("1");
    expect(citation.trustLevel).toBe("direct");
  });

  it("should allow creating a valid ChatSession", () => {
    const session: ChatSession = {
      id: "1",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      pinnedCitations: [],
      topicScope: "javascript" as TopicScope,
    };

    expect(session.id).toBe("1");
    expect(session.topicScope).toBe("javascript");
  });

  it("should allow creating a valid Theme", () => {
    const theme: Theme = {
      mode: "light",
      colors: {
        background: "#ffffff",
        surface: "#f5f5f5",
        primary: "#0066cc",
        secondary: "#666666",
        text: "#000000",
        textSecondary: "#666666",
        border: "#cccccc",
        code: "#f5f5f5",
        userMessage: "#e3f2fd",
        aiMessage: "#f5f5f5",
        citation: "#fff3cd",
        warning: "#ff9800",
        error: "#f44336",
      },
      typography: {
        fontFamily: "system-ui, sans-serif",
        codeFontFamily: "monospace",
        baseFontSize: "16px",
        lineHeight: 1.5,
      },
    };

    expect(theme.mode).toBe("light");
    expect(theme.colors.background).toBe("#ffffff");
  });
});
