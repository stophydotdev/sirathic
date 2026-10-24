import { expect, test } from "bun:test";
import { qibla } from "@sirathic/core/tools/qibla";

test("the qibla bearing from London and New York is the known one", () => {
  const london = qibla({ latitude: 51.5074, longitude: -0.1278 });
  expect(london.bearingDegrees).toBeCloseTo(119, 0);
  expect(london.compass).toBe("east-southeast");
  const newYork = qibla({ latitude: 40.7128, longitude: -74.006 });
  expect(newYork.bearingDegrees).toBeCloseTo(58.5, 0);
  expect(newYork.compass).toBe("east-northeast");
});

test("standing at the Kaaba is reported instead of a meaningless bearing", () => {
  expect(qibla({ latitude: 21.4225, longitude: 39.8262 }).atTheKaaba).toBe(true);
});
