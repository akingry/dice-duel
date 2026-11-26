"""Build dice_duel.html: one self-contained file that runs by double-clicking (no server).

Inputs (next to this script): three.module.js, peerjs.min.js (PeerJS 1.5.5), fonts/cinzel-*.woff2 (OFL), src/template.html, src/styles.css, src/game.js
Usage:  python build_standalone.py            (writes dice_duel.html)
        python build_standalone.py --out index.html
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
import sys
OUT = ROOT / (sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "dice_duel.html")


def three_as_global() -> str:
    code = (ROOT / "three.module.js").read_text(encoding="utf-8")
    m = re.search(r"^export \{([^}]*)\};\s*$", code, re.M)
    if not m:
        raise SystemExit("Could not find the export list in three.module.js")
    names = [n.strip() for n in m.group(1).split(",") if n.strip()]
    body = code[: m.start()] + code[m.end():]
    return (
        "const THREE = (function () {\n'use strict';\n"
        + body
        + "\nreturn { " + ", ".join(names) + " };\n})();\n"
    )


def main():
    html = (SRC / "template.html").read_text(encoding="utf-8")
    import base64
    fonts = ""
    for weight in (400, 700):
        data = base64.b64encode((ROOT / "fonts" / f"cinzel-latin-{weight}-normal.woff2").read_bytes()).decode()
        fonts += ("@font-face { font-family: 'Cinzel'; font-style: normal; font-display: swap; font-weight: %d; "
                  "src: url(data:font/woff2;base64,%s) format('woff2'); }\n" % (weight, data))
    html = html.replace("/*__FONTS__*/", fonts)
    css = (SRC / "styles.css").read_text(encoding="utf-8")
    game = (SRC / "game.js").read_text(encoding="utf-8")
    script = three_as_global() + "\n(function () {\n" + game + "\n})();\n"
    peer = (ROOT / "peerjs.min.js").read_text(encoding="utf-8")
    peer = re.sub(r"//# sourceMappingURL=\S+", "", peer)
    # Keep "</script" sequences inside JS strings from closing the tag early.
    script = script.replace("</script", "<\\/script")
    peer = peer.replace("</script", "<\\/script")
    html = html.replace("/*__STYLES__*/", css).replace("/*__PEERJS__*/", peer).replace("/*__SCRIPT__*/", script)
    OUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
