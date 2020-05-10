import * as core from '@actions/core';
import * as github from '@actions/github';
import axios from 'axios';

const MANIFEST_URL_BASE = 'https://raw.githubusercontent.com';
const JSON_INDENT = 2;

enum Input {
  mods = 'mods',
  gitHubToken = 'github-token',
}

enum Output {
  releases = 'releases',
}

async function run() {
  try {
    const mods: ModInfo[] = JSON.parse(core.getInput(Input.mods));
    const gitHubToken = core.getInput(Input.gitHubToken);
    const octokit = new github.GitHub(gitHubToken);

    const results = [];
    for (let mod of mods) {
      const [owner, repo] = mod.repo.split('/');

      const releaseList = (await octokit.repos.listReleases({
        owner: owner,
        repo: repo,
      })).data.filter(release => !release.prerelease);

      if (releaseList.length === 0) {
        continue;
      }

      const manifest: Manifest = (await axios(
        `${MANIFEST_URL_BASE}/${owner}/${repo}/master/${mod.manifest}`
      )).data;

      results.push({
        releaseList,
        manifest,
      });
    }

    const modReleases: Mod[] = results.map(({ releaseList, manifest }) => {
      const releases: Release[] = releaseList
        .filter(({ assets }) => assets.length > 0)
        .map(release => {
          const asset = release.assets[0];

          return {
            downloadUrl: asset.browser_download_url,
            downloadCount: asset.download_count
          };
        });

      const totalDownloadCount = releases.reduce((accumulator, release) => {
        return accumulator + release.downloadCount;
      }, 0);

      const latestRelease = releases[0];

      const modInfo: Mod = {
        downloadUrl: latestRelease.downloadUrl,
        downloadCount: totalDownloadCount,
        manifest,
      };

      return modInfo;
    });

    const releasesJson = JSON.stringify(modReleases, null, JSON_INDENT);

    core.setOutput(Output.releases, releasesJson);

  } catch (error) {
    core.setFailed(error.message);
    console.log('error', error);
  }
}

run();
