// Iconos de la barra (Hito 67): los mismos grabados que los símbolos del mapa del mundo
// (game-icons.net, CC BY 3.0: Lorc, Delapouite y otros autores; ver assets/hud/LEEME.txt).
// Cada icono es una silueta que se tiñe con el color de lo que hace (fuego, frío, curación, acero…),
// sobre un medallón oscuro, como los iconos pintados de Baldur's Gate 3 pero con el estilo de nuestros mapas.

/** Tintes: el color dice qué es (el icono, cómo). */
export const TINT = {
  acero: "#d9d2c3", oro: "#e6c26a", madera: "#c79a63", piedra: "#b5aa98",
  fuego: "#ff8a3d", frío: "#8fd8ff", relámpago: "#ffe066", radiante: "#fff0a8", necrótico: "#a88bd6", fuerza: "#c6a8ff",
  psíquico: "#ff8fd0", veneno: "#9be36a", ácido: "#c8f05a", trueno: "#7fb4ff", contundente: "#d9d2c3", cortante: "#d9d2c3", perforante: "#d9d2c3",
  cura: "#7fe39a", magia: "#b9a4ff", sagrado: "#ffe7a3", sombra: "#9aa3b5", furia: "#ff6a4a", musica: "#f2a7e0", accion: "#e8dcc0"
};
/** Armas: por el nombre. */
export function weaponGlyph(w) {
  const n = (w.name || "").toLowerCase();
  if (w.improv) return ["rock", "piedra"];
  if (/ballesta/.test(n)) return ["pocket-bow", "madera"];
  if (/arco/.test(n)) return ["bow-arrow", "madera"];
  if (/hacha/.test(n)) return ["battle-axe", "acero"];
  if (/martillo/.test(n)) return ["warhammer", "acero"];
  if (/maza|mangual|lucero/.test(n)) return ["flanged-mace", "acero"];
  if (/garrote|clava/.test(n)) return ["wood-club", "madera"];
  if (/bast[oó]n/.test(n)) return ["wizard-staff", "madera"];
  if (/tridente/.test(n)) return ["trident", "acero"];
  if (/jabalina/.test(n)) return ["thrown-spear", "acero"];
  if (/lanza|pica|alabarda|guja/.test(n)) return ["spear-hook", "acero"];
  if (/dardo/.test(n)) return ["thrown-daggers", "acero"];
  if (/daga/.test(n)) return ["plain-dagger", "acero"];
  if (/honda/.test(n)) return ["sling", "madera"];
  if (/l[aá]tigo/.test(n)) return ["whip", "madera"];
  if (/pu[ñn]o|desarmad/.test(n)) return ["fist", "accion"];
  if (w.spell) return ["bolt-spell-cast", "magia"];
  return w.rng && w.rng.ranged && !w.rng.melee ? ["bow-arrow", "madera"] : ["broadsword", "acero"];
}
export const DAMAGE = { fuego: "fireball", frío: "ice-bolt", relámpago: "lightning-arc", radiante: "sun", necrótico: "dread-skull", fuerza: "star-swirl",
  psíquico: "brain", veneno: "poison-gas", ácido: "acid-blob", trueno: "sonic-boom", contundente: "warhammer", cortante: "sword-brandish", perforante: "thrown-spear" };
/** Conjuros: por nombre (algunos con icono propio) o por lo que hacen. */
export function spellGlyph(d, m) {
  const n = d.n || "";
  if (n === "Escudo") return ["magic-shield", "magia"];
  if (n === "Contrahechizo") return ["interdiction", "magia"];
  if (/Paso brumoso|Teletransporte|Puerta/.test(n)) return ["teleport", "magia"];
  if (/Proyectil m[aá]gico/.test(n)) return ["bolt-spell-cast", "fuerza"];
  if (/Reprensi[oó]n infernal/.test(n)) return ["fire-breath", "fuego"];
  if (m.heal) return ["healing", "cura"];
  if (m.buff === "bendecido") return ["prayer", "sagrado"];
  if (m.buff === "perdicion") return ["spider-web", "sombra"];
  const dt = (m.dt || "").toLowerCase();
  if (DAMAGE[dt]) return [DAMAGE[dt], dt];
  return m.conds && m.conds.length ? ["magic-swirl", "magia"] : ["sparkles", "magia"];
}
export const ACTION = { Correr: ["run", "accion"], Destrabarse: ["exit-door", "accion"], Esquivar: ["dodging", "accion"], Ayudar: ["shaking-hands", "accion"],
  Esconderse: ["hood", "sombra"], Buscar: ["magnifying-glass", "accion"], Estudiar: ["spell-book", "accion"], Influir: ["shaking-hands", "accion"] };
export const MISC = { push: ["push", "accion"], prone: ["foot-trip", "accion"], rage: ["enrage", "furia"], bard: ["lyre", "musica"], feat: ["star-formation", "oro"],
  douse: ["fire-extinguisher", "fuego"], chest: ["open-chest", "oro"], climb: ["ladder", "madera"], down: ["stairs", "madera"], pushobj: ["push", "piedra"],
  multi: ["crossed-swords", "acero"], save: ["whirlwind", "accion"], move: ["wind-slap", "accion"] };
/** Pestañas de la barra. */
export const TABS = { all: "stars-stack", arm: "crossed-swords", spell: "spell-book", hab: "star-formation", com: "cog" };
/** Estados (los de la barra y la ficha). */
export const COND = { agarrado: "grab", apresado: "manacles", asustado: "terror", aturdido: "knocked-out-stars", cegado: "blindfold", derribado: "foot-trip",
  ensordecido: "hearing-disabled", envenenado: "poison-gas", hechizado: "charm", incapacitado: "interdiction", inconsciente: "sleepy", invisible: "invisible",
  paralizado: "frozen-body", petrificado: "stone-bust", agotamiento: "tired-eye", ardiendo: "burning-passion", esquivando: "dodging", destrabado: "exit-door",
  concentracion: "crystal-ball", bendecido: "prayer", perdicion: "spider-web", debilitado: "broken-bone", ralentizado: "snail", molestar: "target-arrows",
  escudo: "magic-shield", furia: "enrage", insp_bardica: "lyre", muerto: "dead-head" };

/** HTML de un icono: silueta teñida (la sombra va en el envoltorio porque la máscara la recortaría). */
// (la imagen va en el estilo del propio elemento: una url() dentro de una variable CSS se resolvería desde la hoja de estilos)
export const glyph = ([k, t], cls = "") => `<span class="gi ${cls}" style="--tint:${TINT[t] || t || TINT.accion}"><i style="-webkit-mask-image:url(assets/hud/${k}.svg);mask-image:url(assets/hud/${k}.svg)"></i></span>`;
export const ALL_GLYPHS = () => [...new Set([...Object.values(DAMAGE), ...Object.values(ACTION).map(x => x[0]), ...Object.values(MISC).map(x => x[0]), ...Object.values(TABS), ...Object.values(COND),
  "rock", "pocket-bow", "bow-arrow", "battle-axe", "warhammer", "flanged-mace", "wood-club", "wizard-staff", "trident", "thrown-spear", "spear-hook", "thrown-daggers", "plain-dagger", "sling", "whip", "fist", "bolt-spell-cast", "broadsword",
  "magic-shield", "interdiction", "teleport", "fire-breath", "healing", "prayer", "spider-web", "magic-swirl", "sparkles"])];
