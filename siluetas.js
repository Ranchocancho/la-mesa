// Siluetas de criaturas para las peanas (game-icons.net, CC BY 3.0; autores en CREDITS.md).
// [id, nombre, palabras clave separadas por comas]
export const SILUETAS = [
  ["goblin", "Goblin", "goblin,trasgo,kobold"],
  ["orco", "Orco", "orco,semiorco,bárbaro,bárbara"],
  ["ogro", "Ogro", "ogro,troll,trol"],
  ["gigante", "Gigante", "gigante"],
  ["ciclope", "Cíclope", "cíclope,ciclope"],
  ["dragon", "Dragón", "dragón,dragon,draco"],
  ["guiverno", "Guiverno", "guiverno,wyvern"],
  ["hidra", "Hidra", "hidra"],
  ["arana", "Araña", "araña,arana"],
  ["lobo", "Lobo", "lobo,huargo,perro"],
  ["hombrelobo", "Hombre lobo", "licántropo,hombre lobo,lobo"],
  ["oso", "Oso", "oso,osolechuza"],
  ["jabali", "Jabalí", "jabalí,jabali"],
  ["murcielago", "Murciélago", "murciélago,murcielago"],
  ["rata", "Rata", "rata"],
  ["serpiente", "Serpiente", "serpiente,víbora,naga"],
  ["escorpion", "Escorpión", "escorpión,escorpion"],
  ["lagarto", "Hombre lagarto", "lagarto,hombre lagarto"],
  ["minotauro", "Minotauro", "minotauro"],
  ["centauro", "Centauro", "centauro"],
  ["arpia", "Arpía", "arpía,arpia"],
  ["ojo", "Contemplador", "contemplador,ojo,beholder"],
  ["fantasma", "Fantasma", "fantasma,espectro,aparición,sombra"],
  ["momia", "Momia", "momia"],
  ["vampiro", "Vampiro", "vampiro"],
  ["diablillo", "Diablillo", "diablillo,imp,diablo menor"],
  ["demonio", "Demonio", "demonio,diablo,infernal"],
  ["limo", "Limo", "limo,cieno,gelatinoso,ooze"],
  ["mimico", "Mímico", "mímico,mimico"],
  ["golem", "Gólem", "gólem,golem,constructo"],
  ["calamar", "Kraken", "kraken,calamar,pulpo"],
  ["medusa", "Medusa", "medusa,gorgona"],
  ["bruja", "Bruja", "bruja,hechicera,saga"],
  ["cultista", "Cultista", "cultista,sectario,acólito"],
  ["bandido", "Bandido", "bandido,maton,matón,ladrón,rufián,pirata"],
  ["arquero", "Arquero", "arquero,explorador,exploradora,arquera"],
  ["asesino", "Asesino", "asesino,pícaro,pícara,picaro"],
  ["encapuchado", "Encapuchado", "encapuchado,figura,desconocido"],
  ["guardia", "Guardias", "guardia,soldado,centinela,guerrero,guerrera,paladín,paladin,caballero"],
  ["mago", "Mago", "mago,archimago,nigromante,hechicero,hechicera,brujo,bruja maga,maga"],
  ["enano", "Enano", "enano"],
  ["monje", "Monje", "monje,sacerdote,clérigo,clérigo,clériga,druida"],
  ["nomuerto", "No muerto", "zombi,zombie,necrófago,no muerto,esqueleto,calavera"],
  ["jefe", "Jefe", "jefe,rey,capitán,líder"],
  ["caballo", "Caballo", "caballo,montura"]
];
export const siluetaURL = id => `assets/siluetas/${id}.svg`;
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/** Elige una silueta por el nombre de la criatura ("Jefe goblin" → goblin). */
export function siluetaFor(name) {
  const n = norm(name);
  let best = null, len = 0;
  for (const [id, , kw] of SILUETAS) for (const k of kw.split(",")) { const w = norm(k); if (w && n.includes(w) && w.length > len) { best = id; len = w.length; } }
  return best || "encapuchado";
}
