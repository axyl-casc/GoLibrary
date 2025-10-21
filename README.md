# Go Library

An offline-first bookshelf experience for Baduk/Go materials. The project combines a Node.js + Express backend with a React front-end to organize and view PDF, SGF, and HTML resources. The backend indexes the local library, generates thumbnails, and persists user-specific state in SQLite. The front-end offers a rich shelf UI with favorites, bookmarks, and resumable reading positions. Check out the project on [GitHub](https://github.com/axyl-casc/GoLibrary).

## Prerequisites

- Node.js 18 LTS or newer
- npm 9+
- Native build tools for `canvas` (e.g., `libcairo2-dev`, `libpango1.0-dev`, `libjpeg-dev`, `libgif-dev` on Debian/Ubuntu)

## Project structure

```
.
├── client/        # React + Vite front-end
├── server/        # Express backend and library indexer
├── migrations/    # SQLite migrations
├── data/          # SQLite database and thumbnails (generated)
└── library/       # Place your PDF, SGF, and HTML files here
```

## Setup

Install dependencies for both workspaces:

```bash
npm install
```

Run database migrations and seed the default user:

```bash
npm run seed
```

## Development

Start the backend and front-end in parallel:

```bash
npm run dev
```

- Server: http://localhost:4000
- Client: http://localhost:5173 (proxied to the API)

## Production build

Build the client bundle and start the server in production mode:

```bash
npm run build
npm run start
```

The Express server will serve both the API and the compiled client.

## Configuration

Environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `LIBRARY_ROOT` | `./library` | Directory containing PDFs, SGFs, and HTML documents |
| `DATA_ROOT` | `./data` | Directory for SQLite database and cached thumbnails |
| `THUMB_WIDTH` | `400` | Width of cover thumbnails |
| `GRID_WIDTH` | `260` | Width of grid thumbnails used in the shelf |
| `CONCURRENCY_THUMBS` | `2` | Max concurrent thumbnail render jobs |
| `ENABLE_HTML_THUMBNAILS` | `false` | Enable experimental HTML thumbnail rendering |
| `PORT` | `4000` | API and static server port |
| `CLIENT_ORIGIN` | *(unset)* | Optional CORS allowlist for the UI |

## Keyboard & UI controls

### Shelf
- Scroll to load more items.
- Click a cover to open the viewer.
- Use the type filter, sort selector, and search box to refine results.

### PDF viewer
- Arrow keys ←/→: previous/next page
- Toolbar buttons: navigate pages, zoom, fit, jump to a page number
- “Add bookmark” button saves the current page with an optional note
- Bookmarks list: click to jump, remove entries with the “Remove” button

### SGF viewer
- Arrow keys ←/→: previous/next node
- Toolbar buttons: first, previous, next, last, autoplay toggle
- “☆ Node” toggles favorites for the current node

### HTML viewer
- Displays sanitized inline HTML

### Favorites & Recents
- Star icons toggle item-level favorites
- Opening a document records it in the user’s recent list (available via API)

### Users
- Switch users from the header menu; state (favorites, positions, bookmarks) is isolated per user
- Add, rename, or delete users without authentication

## Notes

- The backend automatically scans the `library/` directory on startup and watches for changes with `chokidar`.
- PDF thumbnails are rendered with `pdfjs-dist` + `node-canvas`; SGF thumbnails use a lightweight renderer to draw the final position.
- User state (favorites, positions, bookmarks, recents) is stored in `data/library.db`.
- Example documents are sourced from [GoGameGuru](https://gogameguru.com/) and distributed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International Public License](https://creativecommons.org/licenses/by-nc-sa/4.0/).

## Credits

- SGF viewer powered by [Besogo](https://github.com/yewang/besogo).
