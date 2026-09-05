import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { artifactNames, checkArtifacts, checkRelease } from "./desktop-release.mjs";

const valid = {
  tag: "v1.7.0",
  refType: "tag",
  sha: "abc123",
  tagSha: "abc123",
  version: "1.7.0",
  release: { tagName: "v1.7.0", isDraft: true, body: "## Changes\n- Fixed export" },
};

test("accepts a prepared draft at the build revision", () => {
  assert.doesNotThrow(() => checkRelease(valid));
});

test("rejects branch dispatch, version mismatch, and a moved tag", () => {
  for (const change of [
    { refType: "branch" },
    { version: "1.6.0" },
    { tagSha: "different" },
    { tag: "v1.7.0-beta.1" },
  ])
    assert.throws(() => checkRelease({ ...valid, ...change }));
});

test("rejects published releases, missing notes, and another release tag", () => {
  for (const change of [{ isDraft: false }, { body: "  " }, { tagName: "v1.6.0" }])
    assert.throws(() => checkRelease({ ...valid, release: { ...valid.release, ...change } }));
});

test("requires all four nonempty packages for the selected version", () => {
  mkdirSync("temp", { recursive: true });
  const directory = mkdtempSync(resolve("temp", "release-test-"));
  try {
    assert.throws(() => checkArtifacts(directory, valid.version));
    for (const name of artifactNames(valid.version)) {
      writeFileSync(resolve(directory, name), "package");
    }
    assert.equal(checkArtifacts(directory, valid.version).length, 4);
    assert.throws(() => checkArtifacts(directory, "1.6.0"));
    writeFileSync(resolve(directory, artifactNames(valid.version)[3]), "");
    assert.throws(() => checkArtifacts(directory, valid.version));
  } finally {
    rmSync(directory, { recursive: true });
  }
});
