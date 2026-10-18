import { z } from "zod";
import { clip, stophy } from "../stophy";

const REVIEW_CHARS = 500;
const REVIEWS = 10;

export const mapsReviewsInput = z.object({
  placeUrl: z.url().describe("A Google Maps place link from mapsSearch"),
  sort: z
    .enum(["relevance", "newest", "highest", "lowest"])
    .default("relevance"),
});

export const mapsReviews = async (input: z.input<typeof mapsReviewsInput>) => {
  const { placeUrl, sort } = mapsReviewsInput.parse(input);
  const { data } = await stophy.google.maps.reviews({ placeUrl, sort });
  const reviews = data.results.flatMap((review) =>
    review.text
      ? [
          {
            rating: review.rating ?? null,
            text: clip(review.text, REVIEW_CHARS),
            publishedAt: review.publishedAt ?? null,
            ownerReply: review.ownerReplyText
              ? clip(review.ownerReplyText, REVIEW_CHARS)
              : null,
          },
        ]
      : [],
  );
  return { url: placeUrl, reviews: reviews.slice(0, REVIEWS) };
};
