import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { artifactNames, checkArtifacts, checkRelease, runRelease } from "./desktop-release.mjs";

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

function releaseFixture(t, scenario = {}) {
  mkdirSync("temp", { recursive: true });
  const directory = mkdtempSync(resolve("temp", "publish-test-"));
  t.after(() => rmSync(directory, { recursive: true }));
  const assets = artifactNames(valid.version).map((name) => {
    writeFileSync(resolve(directory, name), "package");
    return { name, size: 7 };
  });
  const calls = [];
  let uploaded = false;
  const gh = (...args) => {
    calls.push(args);
    if (args[0] === "api") return uploaded && scenario.movedTag ? "moved" : valid.sha;
    if (args[1] === "view") {
      const release = { ...valid.release, assets };
      if (uploaded) Object.assign(release, scenario.afterUpload);
      return JSON.stringify(release);
    }
    if (args[1] === "upload") {
      if (scenario.uploadFails) throw new Error("Upload failed");
      uploaded = true;
      return "";
    }
    assert.equal(args[1], "edit");
    return "";
  };
  return {
    calls,
    options: {
      command: "publish",
      gh,
      directory,
      version: valid.version,
      context: {
        GITHUB_REF_NAME: valid.tag,
        GITHUB_REF_TYPE: valid.refType,
        GITHUB_SHA: valid.sha,
        GITHUB_REPOSITORY: "owner/repo",
      },
    },
  };
}

test("publishes only after upload and reinspection, preserving prepared title and notes", (t) => {
  const { calls, options } = releaseFixture(t);
  runRelease(options);
  assert.deepEqual(
    calls.map((args) => args.slice(0, 2)),
    [
      ["release", "view"],
      ["api", "repos/owner/repo/commits/v1.7.0"],
      ["release", "upload"],
      ["release", "view"],
      ["api", "repos/owner/repo/commits/v1.7.0"],
      ["release", "edit"],
    ],
  );
  assert.deepEqual(calls.at(-1), [
    "release",
    "edit",
    valid.tag,
    "--repo",
    "owner/repo",
    "--draft=false",
  ]);
});

test("check reads release state without uploading or publishing", (t) => {
  const { calls, options } = releaseFixture(t);
  runRelease({ ...options, command: "check" });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((args) => args[0] === "api" || args[1] === "view"));
});

for (const [name, scenario] of Object.entries({
  "failed upload": { uploadFails: true },
  "moved tag": { movedTag: true },
  "published draft": { afterUpload: { isDraft: false } },
  "missing assets": { afterUpload: { assets: [] } },
  "missing Mac download": {
    afterUpload: {
      assets: artifactNames(valid.version)
        .filter((name) => !name.endsWith(".dmg"))
        .map((name) => ({ name, size: 7 })),
    },
  },
  "wrong asset size": {
    afterUpload: { assets: artifactNames(valid.version).map((name) => ({ name, size: 1 })) },
  },
})) {
  test(`${name} prevents publication`, (t) => {
    const { calls, options } = releaseFixture(t, scenario);
    assert.throws(() => runRelease(options));
    assert.ok(!calls.some((args) => args[1] === "edit"));
  });
}

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

test("requires all five nonempty packages for the selected version", () => {
  mkdirSync("temp", { recursive: true });
  const directory = mkdtempSync(resolve("temp", "release-test-"));
  try {
    assert.throws(() => checkArtifacts(directory, valid.version));
    for (const name of artifactNames(valid.version)) {
      writeFileSync(resolve(directory, name), "package");
    }
    assert.equal(checkArtifacts(directory, valid.version).length, 5);
    assert.throws(() => checkArtifacts(directory, "1.6.0"));
    writeFileSync(resolve(directory, artifactNames(valid.version)[3]), "");
    assert.throws(() => checkArtifacts(directory, valid.version));
  } finally {
    rmSync(directory, { recursive: true });
  }
});
