# Publish Odin on GitHub

The application repository is this directory (`odin/`), not its parent workspace. The intended GitHub destination is **reg1rugas/odin**.

## Publish with GitHub CLI

Install GitHub CLI and authenticate with `gh auth login`. Review the source changes before committing:

```sh
cd "/home/adrick/Desktop/odin project/odin"
git status --short
git diff --stat
git add .
git diff --cached --stat
git commit -m "Prepare Odin for Next Byte Hacks V5"
```

If `reg1rugas/odin` does not exist yet:

```sh
gh repo create reg1rugas/odin --public --source=. --remote=origin --push
```

If it already exists and is empty:

```sh
git remote add origin https://github.com/reg1rugas/odin.git
git push -u origin HEAD
```

If `origin` already exists, inspect it with `git remote -v` before changing it. If the GitHub repository has commits, fetch and reconcile them before pushing; do not force push over existing work.

## Publish without GitHub CLI

Create an empty public repository named `odin` under `reg1rugas` on GitHub. Leave the automatic README, license, and `.gitignore` options unselected because the local repository already contains project files. Commit the reviewed changes using the commands above, then add the remote and push. Use your configured Git credential manager or SSH authentication; do not put an access token in a repository URL or source file.

## What belongs in the repository

Commit the application source, lockfile, migrations, `.dev.vars.example`, and setup instructions. The `.gitignore` excludes provider credentials, dependencies, generated builds, local database/media state, and local tooling state. `.openai/hosting.json` contains the original deployment identity and binding names; it is required by the build and migration scripts and is not a provider credential.

A public repository includes its Git history. Review that history for credentials before publishing; ignoring a file does not remove earlier committed copies. If credentials were ever committed, revoke them and remove them from the history before publication.

## Submission links

- Source: https://github.com/reg1rugas/odin
- Setup instructions: the repository README
- Demo: add the separately hosted demo video URL to Devpost

Confirm the repository is accessible while signed out before submitting its link to the hackathon. Demo footage attribution and its separate Pexels terms are recorded in `public/demo/CREDITS.md`. Choose a source license before describing the project code as open source; making source publicly viewable does not itself grant an open-source license.
