# Extrae el SRD en español página a página, respetando las dos columnas.
import subprocess, json, re, sys
PDF = sys.argv[1]; N = int(sys.argv[2])
pages = []
for p in range(1, N + 1):
    t = subprocess.run(["pdftotext", "-layout", "-f", str(p), "-l", str(p), PDF, "-"], capture_output=True, text=True).stdout
    lines = t.split("\n")
    width = max((len(l) for l in lines), default=0)
    # Buscar el canal entre columnas: la posición cercana al centro con más líneas en blanco
    best, bestscore = None, -1
    for x in range(int(width * 0.35), int(width * 0.65)):
        score = sum(1 for l in lines if len(l) <= x or l[x - 1:x + 2].strip() == "")
        if score > bestscore: best, bestscore = x, score
    two = best and bestscore > 0.9 * len([l for l in lines if l.strip()]) + (len(lines) - len([l for l in lines if l.strip()]))
    if two:
        left = [l[:best].rstrip() for l in lines]; right = [l[best:].strip() for l in lines]
        cols = left + [""] + right
    else:
        cols = lines
    txt = "\n".join(l.strip() for l in cols)
    txt = re.sub(r"\n{3,}", "\n\n", txt).replace("­", "").replace("‑", "-")
    pages.append(txt.strip())
json.dump(pages, open("/tmp/srd_pages.json", "w"), ensure_ascii=False)
print(len(pages))
