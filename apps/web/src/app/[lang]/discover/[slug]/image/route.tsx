import { ImageResponse } from "next/og";
import { articleOf } from "@/content/discover/articles";
import type { Article } from "@/content/discover/schema";

const SIZE = { width: 1200, height: 630 };

const GRADIENTS = {
  teal: "linear-gradient(135deg, #042f2e, #134e4a, #155e75)",
  rose: "linear-gradient(135deg, #4c0519, #881337, #991b1b)",
  amber: "linear-gradient(135deg, #451a03, #78350f, #9a3412)",
  indigo: "linear-gradient(135deg, #1e1b4b, #312e81, #1e40af)",
} satisfies Record<Article["tint"], string>;

export async function GET(
  _request: Request,
  { params }: RouteContext<"/[lang]/discover/[slug]/image">,
) {
  const article = articleOf((await params).slug);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 72,
        color: "white",
        backgroundImage: GRADIENTS[article?.tint ?? "teal"],
      }}
    >
      <div style={{ fontSize: 30, opacity: 0.8 }}>{article?.topic}</div>
      <div style={{ fontSize: 76, lineHeight: 1.1 }}>{article?.title ?? "Sirathic"}</div>
      <div style={{ fontSize: 30, opacity: 0.8 }}>Sirathic</div>
    </div>,
    SIZE,
  );
}
