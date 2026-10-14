import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EndoAcolheMark } from "./EndoAcolheMark";

describe("EndoAcolheMark", () => {
  it("renders a scalable, decorative mark with the shared 48px viewbox", () => {
    const mark = renderToStaticMarkup(<EndoAcolheMark size={20} />);

    expect(mark).toContain('viewBox="0 0 48 48"');
    expect(mark).toContain('aria-hidden="true"');
    expect(mark).toContain('width="20"');
  });
});
