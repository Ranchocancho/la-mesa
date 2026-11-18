# Convierte el SRD 5.2.1 en español (páginas ya extraídas) en datos para La Mesa.
import json, re
P = json.load(open("/tmp/srd_pages.json"))
HEAD = re.compile(r"^(Documento de referencia del sistema 5\.2\.1|\d{1,3})$")
def lines(a, b):  # páginas a..b (1-based, inclusive), sin cabeceras ni números de página
    out = []
    for i in range(a - 1, b):
        for l in P[i].split("\n"):
            if HEAD.match(l.strip()): continue
            out.append(l.strip())
    return out
def join(ls):
    t = "\n".join(ls)
    t = re.sub(r"(\w)-\n(\w)", r"\1\2", t)            # palabras cortadas
    t = re.sub(r"\n{2,}", "\n\n", t)
    paras = [re.sub(r"\s*\n\s*", " ", x).strip() for x in t.split("\n\n")]
    return "\n".join(x for x in paras if x)

# ---------- Conjuros ----------
L = lines(118, 193)
SCHOOL = re.compile(r"^(Truco de ([a-záéíóúñ]+)|([A-ZÁÉÍÓÚ][a-záéíóúñ]+) de nivel (\d))\s*\((.*)$")
starts = []
for i, l in enumerate(L):
    if i and SCHOOL.match(l) and any(L[j].startswith("Tiempo de lanzamiento") for j in range(i + 1, min(i + 4, len(L)))):
        k = i - 1
        while k > 0 and not L[k]: k -= 1
        starts.append((k, i))
spells = []
for n, (k, i) in enumerate(starts):
    end = starts[n + 1][0] if n + 1 < len(starts) else len(L)
    m = SCHOOL.match(L[i]); cls = m.group(5); j = i
    while ")" not in cls and j + 1 < end: j += 1; cls += " " + L[j]
    body = L[j + 1:end]
    f = {}
    rest = []
    for l in body:
        if not l and not rest: continue
        mm = re.match(r"^(Tiempo de lanzamiento|Alcance|Componentes|Duración):\s*(.*)$", l)
        if mm and not rest:
            parts = re.split(r"\s*(Tiempo de lanzamiento|Alcance|Componentes|Duración):\s*", l)[1:]
            for kk in range(0, len(parts) - 1, 2): f[parts[kk]] = parts[kk + 1].strip()
        elif not rest and f and l and not l.endswith(".") and list(f)[-1] == "Componentes" and "(" in f["Componentes"] and ")" not in f["Componentes"]: f["Componentes"] += " " + l
        else: rest.append(l)
    text = join(rest)
    higher = ""
    hm = re.search(r"(Con un espacio de conjuro de nivel superior\.|Mejora de truco\.)\s*(.*)$", text, re.S)
    if hm: higher = hm.group(1) + " " + hm.group(2).strip(); text = text[:hm.start()].strip()
    level = 0 if m.group(2) else int(m.group(4))
    school = (m.group(2) or m.group(3)).lower()
    flat = re.sub(r"\s+", " ", re.sub(r"([a-záéíóúñ])-\s+([a-záéíóúñ])", r"\1\2", text))
    dmg = re.search(r"(\d+d\d+(?:\s*\+\s*\d+)?) de daño (?:de )?([a-záéíóúñ]+)", flat)
    save = re.search(r"tirada de salvación de (Fuerza|Destreza|Constitución|Inteligencia|Sabiduría|Carisma)", text)
    spells.append({"n": L[k], "lvl": level, "esc": school, "cls": cls.rstrip(")").strip(), "t": f.get("Tiempo de lanzamiento", ""), "al": f.get("Alcance", ""),
                   "co": f.get("Componentes", ""), "du": f.get("Duración", ""), "txt": text, "sup": higher,
                   "atk": bool(re.search(r"(tirada de )?ataque (a distancia |cuerpo a cuerpo )?de conjuro|ataque de conjuro (a distancia|cuerpo a cuerpo)", flat, re.I)), "sv": save.group(1) if save else "", "dmg": dmg.group(1).replace(" ", "") if dmg else "", "dt": dmg.group(2) if dmg else ""})
print("conjuros", len(spells))

# ---------- Monstruos y animales ----------
TYPE = re.compile(r"^(Aberración|Bestia|Celestial|Constructo|Dragón|Elemental|Feérico|Infernal|Gigante|Humanoide|Monstruosidad|Cieno|Planta|Muerto viviente|Enjambre)\b.*(Diminut|Pequeñ|Median|Grande|Enorme|Gargantuesc)")
def monsters(a, b):
    L = lines(a, b); out = []
    idx = [i for i, l in enumerate(L) if TYPE.match(l) and any(L[j].startswith("CA:") for j in range(i + 1, min(i + 5, len(L))))]
    for n, i in enumerate(idx):
        k = i - 1
        while k > 0 and not L[k]: k -= 1
        name = L[k]
        k2 = k - 1
        while k2 > 0 and not L[k2]: k2 -= 1
        nxt = idx[n + 1] if n + 1 < len(idx) else len(L)
        e = nxt - 1
        while e > i and not L[e]: e -= 1
        e -= 1                                   # quitar el nombre del siguiente
        while e > i and not L[e]: e -= 1
        if n + 1 < len(idx) and L[e] == L[e + 2 if e + 2 < len(L) else e]: e -= 1
        block = L[i:e + 1]
        raw = "\n".join(block); flat = re.sub(r"([a-záéíóúñ])-\s+([a-záéíóúñ])", r"\1\2", raw); flat = re.sub(r"\s+", " ", flat)
        g = lambda rx, d="": (re.search(rx, flat).group(1) if re.search(rx, flat) else d)
        ab = {}
        for s, key in [("Fue", "fue"), ("Des", "des"), ("Con", "con"), ("Int", "int"), ("Sab", "sab"), ("Car", "car")]:
            mm = re.search(s + r" (\d+) ", flat); ab[key] = int(mm.group(1)) if mm else 10
        atks = []
        for mm in re.finditer(r"([A-ZÁÉÍÓÚÑ][^.:]{1,45})\. Tirada de ataque (?:cuerpo a cuerpo o a distancia|cuerpo a cuerpo|a distancia): ([+−-]\d+)[^.]*?\. Acierto: \d+ \(([^)]+)\) de daño (?:de )?([a-záéíóúñ]+)", flat):
            nm = re.sub(r"^.*?\b(Acciones adicionales|Acciones legendarias|Acciones|Reacciones)\s+", "", mm.group(1)).strip()
            atks.append({"name": nm, "atk": mm.group(2).replace("−", "-"), "dmg": mm.group(3).replace(" ", "") + " " + mm.group(4)})
        hp = g(r"PG: (\d+)"); ac = g(r"CA: (\d+)")
        if not hp or not ac: continue
        out.append({"n": name, "tipo": L[i], "ca": int(ac), "pg": int(hp), "pgd": g(r"PG: \d+ \(([^)]+)\)"), "ini": g(r"Iniciativa: ([+−-]\d+)").replace("−", "-"),
                    "vel": g(r"Velocidad: ([^A-Z]+?)(?= MOD| Fue|$)").strip(), "vd": g(r"VD: ([\d/]+)"), "ab": ab, "atk": atks, "txt": join(block)})
    return out
mons = monsters(283, 375) + monsters(376, 398)
print("monstruos", len(mons), "con ataques", sum(1 for m in mons if m["atk"]))
HY = re.compile(r"([a-záéíóúñ])- ([a-záéíóúñ])")
def fix(o):
    if isinstance(o, str): return HY.sub(r"\1\2", o)
    if isinstance(o, list): return [fix(x) for x in o]
    if isinstance(o, dict): return {k: fix(v) for k, v in o.items()}
    return o
spells, mons = fix(spells), fix(mons)
json.dump(spells, open("/tmp/conjuros.json", "w"), ensure_ascii=False)
json.dump(mons, open("/tmp/monstruos.json", "w"), ensure_ascii=False)
