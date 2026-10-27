# Tarn website

Official language site: installation, practical language documentation, ownership,
errors, compiler/CLI commands, stdlib guides, project status and package catalog.

Pure static HTML/CSS/JavaScript; no React dependency, Node build toolchain or
Python service. JavaScript renders the navigable sections and accessible search.
The package catalog is produced by the independent registry's Tarn validator.
Deployment fetches its generated catalog from the public registry; package
installation continues to use https://tarn-lng.github.io/registry/.

Linux x86_64 and ARM64 prereleases are built with GitHub Actions. install.sh is copied
from the compiler repository tools/release/install.sh; keep both in sync.
Installation verifies release checksums. Source installation remains available. Do not invent download links, mature-platform claims or unimplemented
commands. Canonical detailed documentation stays in the compiler repository.

GitHub Pages deployment runs only on main or manual dispatch. To refresh package
metadata after a registry publication, dispatch the website deployment workflow.
The checked-in catalog.json is a Tarn-generated local preview, overwritten by
fresh registry metadata on deployment. Failure to fetch stops deployment.

For local development, serve this directory with any static HTTP server. Check
all hash routes, search/no results, clipboard actions and narrow screens. Every
Tarn source example must compile with the pinned/current supported compiler.

Typography uses Google Fonts with system fallbacks; content, layout and commands
remain usable if font requests are unavailable.
