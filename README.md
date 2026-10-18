# PhyML Studio

Physics-informed machine learning workbenches for fluid and solid mechanics, casting and manufacturing.
Research Institutes of Sweden × Sweden AI Factory.

The site is plain static HTML, CSS and JavaScript. It needs no build step and no server code, so it runs on GitHub Pages as it is.

## How the site is organised

```
index.html               Home: the gallery, the collection and About, in one page
projects.json            The list of workbenches shown in the collection
assets/
  img/                   Room photograph, frames, painting layers, team portraits, partner logos, favicon
  fonts/                 Subsetted web fonts (Cormorant Garamond, IBM Plex Sans, IBM Plex Mono)
  js/paintings.js        The moving paintings in the gallery
  js/logo.js             The living PhyML Studio mark
  js/shell.js            The shared header that every workbench loads
  thumbs/                Collection card images
projects/
  tystprop/index.html    TystProp, propeller design workbench
  pinns-starter/         Placeholder until the workbench is ready
  pinns-advanced/        Placeholder until the workbench is ready
```

Visitors move through the site like this:

1. `index.html` opens with the loader ("the conservator's lamp"), then the gallery.
2. **Take a seat** opens the collection (`#collection`). The PhyML Studio mark opens About (`#about`).
3. A collection card opens its workbench in a new tab, so the gallery stays open behind it. Workbench pages are prefetched when the collection opens, so they appear straight away.
4. Every workbench carries the shared header, with links back to the collection and to About.

## Adding a workbench

1. Put the workbench in its own folder: `projects/<id>/index.html`. Keep it self-contained.
2. Add the shared header just before `</body>`:
   ```html
   <script src="../../assets/js/shell.js" defer></script>
   ```
3. Add a 16:10 card image as `assets/thumbs/<id>.webp` (800 × 500 works well).
4. Add an entry to `projects.json`:
   ```json
   {
     "id": "my-workbench",
     "title": "My Workbench",
     "subtitle": "One line on what it is",
     "wing": "Fluids · Solids",
     "summary": "Two sentences on what it does and for whom.",
     "formats": ["Fluent", "COMSOL", "CSV"],
     "status": "available",
     "path": "projects/my-workbench/",
     "thumb": "assets/thumbs/my-workbench.webp"
   }
   ```
   Use `"status": "soon"` to show the card as coming soon.

The collection reads `projects.json` when it opens, so adding an entry needs no change to `index.html`. `index.html` also carries a built-in copy of the list as a fallback for when the page is opened straight from disk.

The summaries for PINNs-Starter and PINNs-Advanced are placeholders. Replace them when those workbenches are added.

## Publishing on GitHub Pages

1. Push this folder to the root of a repository, for example `phyml-studio`.
2. Go to **Settings → Pages**, choose **Deploy from a branch**, then select the `main` branch and `/ (root)`.
3. The site appears at `https://<organisation>.github.io/phyml-studio/`.
4. Optional: to use a custom domain such as `phyml.ri.se`, add a `CNAME` file containing the domain and point a DNS CNAME record at `<organisation>.github.io`.

The empty `.nojekyll` file tells GitHub Pages to serve the files exactly as they are.

### Before going public

- **Room photograph.** `assets/img/room.jpg` is based on a museum photograph. Confirm RISE has the rights to use it, or replace it with a licensed or in-house photo of a similar room.
- **Visibility.** A GitHub Pages site is public, even when the repository is private, unless the organisation uses GitHub Enterprise with access control. Publishing Pages from a private repository needs a paid plan.
- **Large files.** GitHub blocks files over 100 MB. Keep large reference datasets out of the repository, or use Git LFS or external storage.
- **Data stays local.** The workbenches run entirely in the browser, so data that visitors load never leaves their computer.

## Previewing locally

Open a terminal in this folder and run:

```
python -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` directly from disk also works, but the collection then uses the list built into the page rather than `projects.json`.

## Speed

- The home page is about 110 KB of HTML. The images, fonts and scripts load as separate, cacheable files, about 1 MB in total on a first visit.
- The paintings start from pre-painted layers, and only their moving strokes are drawn in the browser.
- In testing, the gallery was ready about 0.8 seconds after the request. The loader then plays its 8-second sequence on the first visit in a session and a shorter one on later visits, and **Skip ›** goes straight in.
- Workbenches load on their own, at their original size, with no gallery inside them.
