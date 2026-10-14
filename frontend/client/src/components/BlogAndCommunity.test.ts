import { describe, expect, it } from "vitest";
import { blogCopy } from "./BlogAndCommunity";

describe("blogCopy", () => {
  it("fornece cópia completa do blog e relatos em português, inglês e espanhol", () => {
    expect(Object.keys(blogCopy).sort()).toEqual(["en", "es", "pt"]);

    for (const copy of Object.values(blogCopy)) {
      expect(copy.blogTitle).toBeTruthy();
      expect(copy.storiesTitle).toBeTruthy();
      expect(copy.posts).toHaveLength(3);
      expect(copy.filters.all).toBeTruthy();
      expect(copy.result(2)).toContain("2");
      expect(copy.characters(20)).toContain("1600");
      expect(copy.restricted).toBeTruthy();
    }
  });
});
