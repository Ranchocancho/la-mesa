// Objetos especiales (sellos, ofrendas, regalos, reliquias…) y el cuaderno de cada personaje.
// Los objetos especiales no son equipo: cuentan una historia (quién te lo dio, dónde, qué se sabe y qué no).
// El máster puede regalarlos; al jugador le llega un aviso. El cuaderno son notas sueltas con fecha de sesión.
import { store, uid } from "./store.js";
import { isDM, currentUser } from "./session.js";
import { liveSession, sessionName, addEntry } from "./sesiones.js";
import { toast } from "./ui.js";

export const TKINDS = {
  sello: ["🔏", "Sello"], ofrenda: ["🕯", "Ofrenda"], regalo: ["🎁", "Regalo"], reliquia: ["🏺", "Reliquia"], carta: ["📜", "Carta o documento"],
  llave: ["🗝", "Llave"], magico: ["✨", "Objeto mágico"], recuerdo: ["💠", "Recuerdo"], trofeo: ["🏆", "Trofeo"]
};
const C = (s, id) => s.characters.find(c => c.id === id);
const sessLabel = s => { const l = liveSession(s); return l ? sessionName(l) : ""; };

export function giveTreasure(charIds, t) {
  const s0 = store.get(), session = sessLabel(s0);
  store.commit("char", s => charIds.forEach(id => { const c = C(s, id); if (!c) return; c.treasures = c.treasures || [];
    c.treasures.unshift({ id: uid("tes"), kind: t.kind || "regalo", name: t.name || "Objeto", from: t.from || "", where: t.where || "", text: t.text || "", secret: t.secret || "", revealed: false, img: t.img || null, at: Date.now(), session, gift: isDM(s0) }); }));
}
export const editTreasure = (charId, tid, fn, label = "char") => store.commit(label, s => { const c = C(s, charId), t = c && (c.treasures || []).find(x => x.id === tid); if (t) fn(t, c); });
export const dropTreasure = (charId, tid) => store.commit("char", s => { const c = C(s, charId); if (c) c.treasures = (c.treasures || []).filter(x => x.id !== tid); });

export function addNote(charId, text, star = false) {
  if (!text.trim()) return;
  const session = sessLabel(store.get());
  store.commit("char", s => { const c = C(s, charId); if (!c) return; c.journal = c.journal || []; c.journal.unshift({ id: uid("nota"), at: Date.now(), session, text: text.trim(), star: !!star }); });
}
export const editNote = (charId, nid, fn, label = "char") => store.commit(label, s => { const c = C(s, charId), n = c && (c.journal || []).find(x => x.id === nid); if (n) fn(n); });
export const dropNote = (charId, nid) => store.commit("char", s => { const c = C(s, charId); if (c) c.journal = (c.journal || []).filter(x => x.id !== nid); });
/** Compartir una nota con el grupo: pasa a la crónica de la sesión en curso. */
export function shareNote(charId, nid) {
  const s = store.get(), c = C(s, charId), n = c && (c.journal || []).find(x => x.id === nid), l = liveSession(s);
  if (!n) return; if (!l) return toast("Para compartirla tiene que haber una sesión en curso.");
  addEntry(l.id, `${c.name}: ${n.text}`); editNote(charId, nid, x => { x.shared = true; }); toast("Compartida en la crónica");
}

/** Aviso al jugador cuando recibe un objeto. */
export function watchGifts() {
  let seen = null;
  store.subscribe(() => {
    const s = store.get(), me = currentUser(s); if (!me || isDM(s)) return;
    const mine = s.characters.filter(c => c.owner === me.id).flatMap(c => (c.treasures || []).map(t => [t, c]));
    if (seen === null) { seen = new Set(mine.map(([t]) => t.id)); return; }
    mine.forEach(([t, c]) => { if (seen.has(t.id)) return; seen.add(t.id); if (t.gift) toast(`🎁 ${c.name.split(" ")[0]} recibe: ${t.name}${t.from ? ` (de ${t.from})` : ""}`); });
  });
}
