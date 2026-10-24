import { expect, test } from "bun:test";
import { withoutStopwords } from "@sirathic/core/search/arabic";

test("keyword queries drop Arabic stopwords and keep every other word as written", () => {
  expect(withoutStopwords("حكم تعجيل الزكاة قبل الحول في المال")).toBe(
    "حكم تعجيل الزكاة قبل الحول المال",
  );
  expect(withoutStopwords("صلاة المسافر على الراحلة")).toBe("صلاة المسافر الراحلة");
  expect(withoutStopwords("Can I pray Fajr after sunrise?")).toBe("Can I pray Fajr after sunrise?");
});
