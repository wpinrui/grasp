import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function checkRelease({ tag, refType, sha, version, release, tagSha }) {
  assert.equal(refType, "tag", "Dispatch this workflow against a release tag");
  assert.match(tag, /^v\d+\.\d+\.\d+$/, "Expected a stable vX.Y.Z tag");
  assert.equal(tag, `v${version}`, "Tag must match package.json version");
  assert.equal(tagSha, sha, "Release tag moved since this run started");
  assert.equal(release.tagName, tag, "Release tag does not match");
  assert.equal(release.isDraft, true, "Release must still be a draft");
  assert.ok(release.body?.trim(), "Write release notes before starting builds");
}

export function artifactNames(version) {
  return [
    `GRASP-${version}-setup.exe`,
    `GRASP-${version}-portable.exe`,
    `GRASP-${version}-x86_64.AppImage`,
    `GRASP-${version}-amd64.deb`,
    `GRASP-${version}-universal.dmg`,
  ];
}

export function checkArtifacts(directory, version) {
  return artifactNames(version).map((name) => {
    const path = resolve(directory, name);
    const stat = statSync(path);
    assert.ok(stat.isFile() && stat.size > 0, `Missing or empty package: ${name}`);
    return path;
  });
}

export function runRelease({ command, context, gh, version, directory = "dist/desktop" }) {
  assert.ok(["check", "publish"].includes(command), "Use check or publish");
  const {
    GITHUB_REF_NAME: tag,
    GITHUB_REF_TYPE: refType,
    GITHUB_SHA: sha,
    GITHUB_REPOSITORY: repository,
  } = context;
  assert.equal(refType, "tag", "Dispatch this workflow against a release tag");
  assert.match(tag, /^v\d+\.\d+\.\d+$/);
  assert.ok(repository && sha, "GitHub Actions context is required");
  const inspect = () => {
    const release = JSON.parse(
      gh("release", "view", tag, "--repo", repository, "--json", "tagName,isDraft,body,assets"),
    );
    const tagSha = gh("api", `repos/${repository}/commits/${tag}`, "--jq", ".sha");
    checkRelease({ tag, refType, sha, version, release, tagSha });
    return release;
  };
  inspect();
  if (command === "check") return;
  const files = checkArtifacts(directory, version);
  // Replacement is limited to expected packages on an unpublished draft.
  gh("release", "upload", tag, ...files, "--repo", repository, "--clobber");
  const release = inspect();
  for (const name of artifactNames(version)) {
    const asset = release.assets.find((item) => item.name === name);
    assert.equal(
      asset?.size,
      statSync(resolve(directory, name)).size,
      `Uploaded package size does not match: ${name}`,
    );
  }
  gh("release", "edit", tag, "--repo", repository, "--draft=false");
  console.log(`Published ${tag} with all ${files.length} desktop packages`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runRelease({
    command: process.argv[2],
    context: process.env,
    gh: (...args) => execFileSync("gh", args, { encoding: "utf8" }).trim(),
    version: JSON.parse(readFileSync("package.json", "utf8")).version,
  });
}
