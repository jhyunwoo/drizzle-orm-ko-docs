## 🚀 Project Structure

MDX files are located in this folder:

```text
├── src/
│   ├── content/
│   │   └── docs
```

Announcements markdown files:

```text
├── src/
│   ├──data/
│   │   └── announcements
```

Roadmap markdown file:

```text
├── src/
│   ├──data/
│   │   └── roadmap.md
```

Shipping section yaml file:

```text
├── src/
│   ├──data/
│   │   └── shipping.yaml
```

```
progress: number
weeks:
  - date:
      start: "YYYY-MM-DD"
    details:

## Korean documentation work

This repository is a Korean documentation workspace for Drizzle ORM. It keeps the site content, announcements, roadmap data, and shipping information together so changes can be reviewed in the context in which readers encounter them.

The main challenge is to translate database and TypeScript concepts accurately while preserving MDX structure, code blocks, navigation, and the upstream project's release information. The documented content layout makes those responsibilities explicit and supports repeatable local site builds before publishing.

## Status

Documentation and translation repository. It is maintained as a learning and localization reference rather than an independent ORM implementation.
      - string
```


## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm run dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm run build`           | Build your production site to `./dist/`          |
| `pnpm run preview`         | Preview your build locally, before deploying     |
| `pnpm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm run astro -- --help` | Get help using the Astro CLI                     |
