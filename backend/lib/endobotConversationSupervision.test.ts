import { describe, expect, it } from "vitest";
import { parseEndoBotConversationId } from "./endobotConversationSupervision.js";

describe("EndoBot conversation supervision input", () => {
  it("accepts only a UUID conversation identifier", () => {
    expect(parseEndoBotConversationId("f6bbd4ce-b7cd-4ca3-9b7e-9c7e2940cabf")).toBe("f6bbd4ce-b7cd-4ca3-9b7e-9c7e2940cabf");
    expect(parseEndoBotConversationId("not-a-conversation")).toBeNull();
    expect(parseEndoBotConversationId({ id: "f6bbd4ce-b7cd-4ca3-9b7e-9c7e2940cabf" })).toBeNull();
  });
});
