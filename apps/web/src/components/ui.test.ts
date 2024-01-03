import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Problem } from "@/lib/problem";
import { ProblemNotice } from "./ui";

const issue = (row: number, side?: "before" | "after") => ({
  severity: "error",
  ruleId: "R001",
  code: "LAST_NAME_REQUIRED",
  message: `Row ${row} has no last name.`,
  row,
  ...(side === undefined ? {} : { side }),
});

const render = (problem: Problem) =>
  renderToStaticMarkup(createElement(ProblemNotice, { problem }));

describe("ProblemNotice", () => {
  it("shows the title and detail of the problem", () => {
    const html = render({
      status: 502,
      code: "API_UNAVAILABLE",
      title: "Service unavailable",
      detail: "The validation service could not be reached.",
    });
    expect(html).toContain("Service unavailable");
    expect(html).toContain("The validation service could not be reached.");
    expect(html).toContain('role="alert"');
  });

  it("LIST_INVALID from compare: names the list (side) and row of each error", () => {
    const html = render({
      status: 422,
      code: "LIST_INVALID",
      title: "List invalid",
      detail: "One or both rooming lists have errors.",
      issues: [issue(3, "before"), issue(5, "after")],
    });
    expect(html).toContain("Earlier list, row 3: </strong>");
    expect(html).toContain("Later list, row 5: </strong>");
  });

  it("shows ten errors and says how many more there are", () => {
    const issues = Array.from({ length: 13 }, (_, index) => issue(index + 2));
    const html = render({
      status: 422,
      code: "LIST_INVALID",
      title: "List invalid",
      detail: "The list has errors.",
      issues,
    });
    expect(html.match(/<li>/g)).toHaveLength(10);
    expect(html).toContain("…and 3 more errors.");
  });
});
