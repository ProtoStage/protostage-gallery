# ProtoStage Gallery — Interactive Prototype Showcase

> Live interactive mobile & web prototypes created with [ProtoStage](https://github.com/Charlie-HV97/protostage).

Explore the live gallery at: **[https://charlie-hv97.github.io/protostage-gallery](https://charlie-hv97.github.io/protostage-gallery)**

---

## 📱 What is this repository?

This repository serves as the public hosting backend and showcase hub for ProtoStage prototypes. When designers run:

```bash
proto publish <slug>
```

The compiled prototype, along with its responsive device frame, dynamic scenario routes, Open Graph social share cards, and embed snippets, is published here and automatically deployed to GitHub Pages.

---

## 🚀 How It Works

1. **Standalone & Decoupled:** Prototype hosting is decoupled from the core ProtoStage engine. Anyone can publish prototypes here without needing repository write access to the tool source code.
2. **Universal Embeds:** Every published prototype includes clean embed snippets:
   - **Responsive HTML iframe:** Seamlessly drops into Webflow, Framer, Notion, or custom HTML portfolio case studies.
   - **Universal Embed Script:** Auto-resizing script tag that handles responsive scaling and orientation changes.
3. **Live In-Frame Feedback:** Readers and clients can drag bounding boxes directly on any screen to leave pinpoint visual feedback stored in GitHub Issues.
4. **Social Sharing:** Every prototype is automatically provisioned with a 1200×630 Open Graph card ready for preview on Twitter/X, LinkedIn, and iMessage.

---

## 🎨 Directory Structure

```text
protostage-gallery/
├── index.html            # Main showcase hub & search interface
├── gallery.css           # Showcase styles & responsive grid
├── gallery.js            # Prototype filtering and modal controller
├── showcase.json         # Public manifest of published prototypes
├── preview-embed.html    # Portfolio case study embed simulator
├── embed/
│   └── embed-frame.js    # Embed loader script for third-party websites
├── assets/
│   ├── og-card.png       # 1200x630 social card
│   └── og-card.svg       # Vector source card
└── designers/
    └── <author-slug>/
        └── <prototype-slug>/
            ├── index.html       # Full device stage with controls
            ├── embed.html       # Isolated embed view (iframe target)
            ├── og-card.png      # Prototype social preview
            └── ...              # Flow assets & screens
```

---

## 🤝 Community Submissions

Designers can submit their own prototypes to this showcase:
1. Fork this repository.
2. Add your prototype folder under `designers/<your-name>/<slug>/`.
3. Add your entry to `showcase.json`.
4. Submit a Pull Request.

---

## 📜 Attribution & License

Built with [ProtoStage](https://github.com/Charlie-HV97/protostage) by [Charlie Herbozo-Vidal](https://charlie-hv97.github.io).  
Licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html).
