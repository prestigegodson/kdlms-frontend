import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RichContent } from "@/components/richText/RichContent";

describe("RichContent", () => {
  it("renders every tag in the allowed vocabulary", () => {
    const html =
      "<p><strong>b</strong><em>i</em><u>u</u><s>s</s><code>c</code><sub>sub</sub><sup>sup</sup><br></p>" +
      "<ul><li>one</li></ul><ol><li>two</li></ol>";
    const { container } = render(<RichContent html={html} />);

    expect(container.querySelector("strong")).toHaveTextContent("b");
    expect(container.querySelector("em")).toHaveTextContent("i");
    expect(container.querySelector("u")).toHaveTextContent("u");
    expect(container.querySelector("s")).toHaveTextContent("s");
    expect(container.querySelector("code")).toHaveTextContent("c");
    expect(container.querySelector("sub")).toHaveTextContent("sub");
    expect(container.querySelector("sup")).toHaveTextContent("sup");
    expect(container.querySelector("br")).not.toBeNull();
    expect(container.querySelector("ul li")).toHaveTextContent("one");
    expect(container.querySelector("ol li")).toHaveTextContent("two");
  });

  it("drops a script tag AND its source text, not just the tag", () => {
    const { container } = render(<RichContent html="<p>Hello</p><script>window.x = 1</script>" />);

    expect(container.querySelector("script")).toBeNull();
    expect(container).toHaveTextContent("Hello");
    expect(container).not.toHaveTextContent("window.x");
  });

  it("never emits a raw src attribute for an image - only through the renderImage callback", () => {
    const renderImage = vi.fn(() => <span data-testid="image-slot" />);
    const { container, getByTestId } = render(
      <RichContent
        html={'<p><img data-file-id="11111111-1111-1111-1111-111111111111" alt="diagram"></p>'}
        renderImage={renderImage}
      />,
    );

    expect(renderImage).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111", "diagram");
    expect(getByTestId("image-slot")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("drops an image silently when no renderImage callback is given", () => {
    const { container } = render(
      <RichContent html='<p>Pick <img data-file-id="11111111-1111-1111-1111-111111111111"> this</p>' />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("Pick");
    expect(container).toHaveTextContent("this");
  });

  it("resolves an image embedded in a choice option's label the same way a prompt's is (Phase 20J)", () => {
    const renderImage = vi.fn(() => <span data-testid="option-image-slot" />);
    const { getByTestId } = render(
      <RichContent
        html='<img data-file-id="22222222-2222-2222-2222-222222222222" alt="triangle">'
        renderImage={renderImage}
      />,
    );

    expect(renderImage).toHaveBeenCalledWith("22222222-2222-2222-2222-222222222222", "triangle");
    expect(getByTestId("option-image-slot")).not.toBeNull();
  });

  it("renders a well-formed inline-math span as KaTeX markup", () => {
    const { container } = render(
      <RichContent html='<p><span data-type="inline-math" data-latex="x^2"></span></p>' />,
    );

    expect(container.querySelectorAll(".katex")).toHaveLength(1);
  });

  it("unwraps a span that isn't shaped like the math node, keeping its text", () => {
    const { container } = render(<RichContent html='<p><span class="whatever">plain text</span></p>' />);

    expect(container.querySelectorAll(".katex")).toHaveLength(0);
    expect(container).toHaveTextContent("plain text");
  });

  it("drops an unrecognised tag but keeps its children, mirroring the backend sanitizer's unwrap behaviour", () => {
    const { container } = render(<RichContent html='<p>before <a href="https://evil.example">link text</a> after</p>' />);

    expect(container.querySelector("a")).toBeNull();
    expect(container).toHaveTextContent("before link text after");
  });

  // ---- lesson-note document mode vocabulary (Phase 16G) ----

  it("renders headings", () => {
    const { container } = render(<RichContent html="<h2>Section</h2><h3>Sub</h3><h4>Detail</h4>" />);

    expect(container.querySelector("h2")).toHaveTextContent("Section");
    expect(container.querySelector("h3")).toHaveTextContent("Sub");
    expect(container.querySelector("h4")).toHaveTextContent("Detail");
  });

  it("renders a blockquote and a horizontal rule", () => {
    const { container } = render(<RichContent html="<blockquote><p>Quoted</p></blockquote><hr>" />);

    expect(container.querySelector("blockquote")).toHaveTextContent("Quoted");
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("renders a table with colspan and rowspan intact", () => {
    const html =
      "<table><thead><tr><th colspan=\"2\">Step</th></tr></thead>" +
      '<tbody><tr><td rowspan="2">Teacher</td><td>Learner</td></tr></tbody></table>';
    const { container } = render(<RichContent html={html} />);

    expect(container.querySelector("table")).not.toBeNull();
    const th = container.querySelector("th");
    expect(th).toHaveTextContent("Step");
    expect(th?.getAttribute("colspan")).toBe("2");
    const firstTd = container.querySelector("td");
    expect(firstTd).toHaveTextContent("Teacher");
    expect(firstTd?.getAttribute("rowspan")).toBe("2");
  });

  it("renders a well-formed block-math div as centred KaTeX markup", () => {
    const { container } = render(
      <RichContent html='<div data-type="block-math" data-latex="\\sum_{i=1}^{n} x_i"></div>' />,
    );

    expect(container.querySelectorAll(".katex-display")).toHaveLength(1);
  });

  it("unwraps a div that isn't shaped like the block-math node, keeping its text", () => {
    const { container } = render(<RichContent html='<div class="whatever">plain text</div>' />);

    expect(container.querySelectorAll(".katex")).toHaveLength(0);
    expect(container).toHaveTextContent("plain text");
  });
});
