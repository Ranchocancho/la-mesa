# Glosario de reglas (pp. 194-210) en entradas: {término: texto}
import json, re
P = json.load(open("/home/claude/la-mesa/js/data/srd/paginas.json"))
L = []
for i in range(193, 210):
    for l in P[i].split("\n"):
        l = l.strip()
        if re.fullmatch(r"(Documento de referencia del sistema 5\.2\.1|\d{1,3}|Glosario de reglas)", l): continue
        L.append(l)
def is_head(i):
    l = L[i]
    if not l or len(l) > 48 or l.endswith((".", ",", ";", ":")) or not re.match(r"^[A-ZÁÉÍÓÚÑ]", l): return False
    if re.search(r"\[[a-záéíóú ]+\]$", l): return True
    prev = next((L[j] for j in range(i - 1, max(-1, i - 3), -1) if L[j]), ".")
    nxt = next((L[j] for j in range(i + 1, min(len(L), i + 3)) if L[j]), "")
    return prev.endswith((".", ":", ")")) and len(l.split()) <= 5 and nxt[:1].isupper() and not re.search(r"\d", l)
entries, cur, buf = {}, None, []
for i, l in enumerate(L):
    if is_head(i):
        if cur: entries[cur] = buf
        cur, buf = l, []
    elif cur: buf.append(l)
if cur: entries[cur] = buf
out = {}
for k, ls in entries.items():
    t = "\n".join(ls); t = re.sub(r"([a-záéíóúñ])-\n+([a-záéíóúñ])", r"\1\2", t)
    paras, c = [], ""
    for l in [x for x in t.split("\n") if x.strip()]:
        if c and re.search(r"[.:!?)]$", c) and re.match(r"^[A-ZÁÉÍÓÚÑ¿¡«•]", l): paras.append(c); c = l
        else: c = (c + " " + l).strip()
    if c: paras.append(c)
    name = re.sub(r"\s*\[([^\]]+)\]$", "", k); kind = (re.search(r"\[([^\]]+)\]$", k) or [None, ""])[1]
    if paras: out[name] = {"tipo": kind, "txt": "\n".join(paras)}
json.dump(out, open("/home/claude/la-mesa/js/data/srd/glosario.json", "w"), ensure_ascii=False)
print(len(out)); print([k for k in out][:200])
