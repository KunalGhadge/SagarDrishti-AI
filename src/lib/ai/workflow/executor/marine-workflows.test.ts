// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GetWeather, BabyResearch } from "../examples";
import { SAGARDRISHTI_PRESEEDED_WORKFLOWS } from "../../marine-workflows-seed";

describe("marine preseeded workflows structure and definitions", () => {
  it("validates GetWeather DAG structure", () => {
    const weather = GetWeather();
    expect(weather.nodes.length).toBeGreaterThan(0);
    expect(weather.edges.length).toBeGreaterThan(0);
  });

  it("validates BabyResearch DAG structure", () => {
    const research = BabyResearch();
    expect(research.nodes.length).toBeGreaterThan(0);
    expect(research.edges.length).toBeGreaterThan(0);
  });

  it("validates SAGARDRISHTI_PRESEEDED_WORKFLOWS definitions", () => {
    expect(SAGARDRISHTI_PRESEEDED_WORKFLOWS.length).toBe(2);
    const weather = SAGARDRISHTI_PRESEEDED_WORKFLOWS.find(
      (w) => w.id === "sagar-drishti-coastal-weather",
    );
    const research = SAGARDRISHTI_PRESEEDED_WORKFLOWS.find(
      (w) => w.id === "sagar-drishti-deep-research",
    );

    expect(weather).toBeDefined();
    expect(weather?.nodes.length).toBeGreaterThan(0);
    expect(weather?.edges.length).toBeGreaterThan(0);

    expect(research).toBeDefined();
    expect(research?.nodes.length).toBeGreaterThan(0);
    expect(research?.edges.length).toBeGreaterThan(0);
  });
});
