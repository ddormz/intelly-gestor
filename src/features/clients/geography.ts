type CityEntry = readonly [name: string, communes: readonly string[]];
type RegionEntry = { name: string; aliases: readonly string[]; cities: readonly CityEntry[] };

const GEOGRAPHY: readonly RegionEntry[] = [
  { name: "Arica y Parinacota", aliases: [], cities: [["Arica", ["Arica", "Camarones"]], ["Parinacota", ["Putre", "General Lagos"]]] },
  { name: "Tarapacá", aliases: ["Tarapaca"], cities: [["Iquique", ["Iquique", "Alto Hospicio"]], ["Tamarugal", ["Pozo Almonte", "Camiña", "Colchane", "Huara", "Pica"]]] },
  { name: "Antofagasta", aliases: [], cities: [["Antofagasta", ["Antofagasta", "Mejillones", "Sierra Gorda", "Taltal"]], ["El Loa", ["Calama", "Ollagüe", "San Pedro de Atacama"]], ["Tocopilla", ["Tocopilla", "María Elena"]]] },
  { name: "Atacama", aliases: [], cities: [["Copiapó", ["Copiapó", "Caldera", "Tierra Amarilla"]], ["Chañaral", ["Chañaral", "Diego de Almagro"]], ["Huasco", ["Vallenar", "Alto del Carmen", "Freirina", "Huasco"]]] },
  { name: "Coquimbo", aliases: [], cities: [["Elqui", ["La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paihuano", "Vicuña"]], ["Choapa", ["Illapel", "Canela", "Los Vilos", "Salamanca"]], ["Limarí", ["Ovalle", "Combarbalá", "Monte Patria", "Punitaqui", "Río Hurtado"]]] },
  { name: "Valparaíso", aliases: ["Valparaiso"], cities: [["Valparaíso", ["Valparaíso", "Casablanca", "Concón", "Juan Fernández", "Puchuncaví", "Quintero", "Viña del Mar"]], ["Isla de Pascua", ["Rapa Nui", "Isla de Pascua"]], ["Los Andes", ["Los Andes", "Calle Larga", "Rinconada", "San Esteban"]], ["Petorca", ["La Ligua", "Cabildo", "Papudo", "Petorca", "Zapallar"]], ["Quillota", ["Quillota", "La Calera", "Hijuelas", "La Cruz", "Nogales"]], ["San Antonio", ["San Antonio", "Algarrobo", "Cartagena", "El Quisco", "El Tabo", "Santo Domingo"]], ["San Felipe de Aconcagua", ["San Felipe", "Catemu", "Llaillay", "Panquehue", "Putaendo", "Santa María"]], ["Marga Marga", ["Quilpué", "Limache", "Olmué", "Villa Alemana"]]] },
  { name: "Región Metropolitana", aliases: ["Metropolitana de Santiago", "Region Metropolitana"], cities: [["Santiago", ["Santiago", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba", "Independencia", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", "Vitacura"]], ["Cordillera", ["Puente Alto", "Pirque", "San José de Maipo"]], ["Chacabuco", ["Colina", "Lampa", "Tiltil"]], ["Maipo", ["San Bernardo", "Buin", "Calera de Tango", "Paine"]], ["Melipilla", ["Melipilla", "Alhué", "Curacaví", "María Pinto", "San Pedro"]], ["Talagante", ["Talagante", "El Monte", "Isla de Maipo", "Padre Hurtado", "Peñaflor"]]] },
  { name: "O'Higgins", aliases: ["Libertador General Bernardo O'Higgins", "Libertador General Bernardo OHiggins"], cities: [["Cachapoal", ["Rancagua", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "Las Cabras", "Machalí", "Malloa", "Mostazal", "Olivar", "Peumo", "Pichidegua", "Quinta de Tilcoco", "Rengo", "Requínoa", "San Vicente"]], ["Cardenal Caro", ["Pichilemu", "La Estrella", "Litueche", "Marchihue", "Navidad", "Paredones"]], ["Colchagua", ["San Fernando", "Chépica", "Chimbarongo", "Lolol", "Nancagua", "Palmilla", "Peralillo", "Placilla", "Pumanque", "Santa Cruz"]]] },
  { name: "Maule", aliases: [], cities: [["Talca", ["Talca", "Constitución", "Curepto", "Empedrado", "Maule", "Pelarco", "Pencahue", "Río Claro", "San Clemente", "San Rafael"]], ["Cauquenes", ["Cauquenes", "Chanco", "Pelluhue"]], ["Curicó", ["Curicó", "Hualañé", "Licantén", "Molina", "Rauco", "Romeral", "Sagrada Familia", "Teno", "Vichuquén"]], ["Linares", ["Linares", "Colbún", "Longaví", "Parral", "Retiro", "San Javier", "Villa Alegre", "Yerbas Buenas"]]] },
  { name: "Ñuble", aliases: ["Nuble"], cities: [["Diguillín", ["Chillán", "Bulnes", "Chillán Viejo", "El Carmen", "Pemuco", "Pinto", "Quillón", "San Ignacio", "Yungay"]], ["Itata", ["Cobquecura", "Coelemu", "Ninhue", "Portezuelo", "Quirihue", "Ránquil", "Trehuaco"]], ["Punilla", ["San Carlos", "Coihueco", "Ñiquén", "San Fabián", "San Nicolás"]]] },
  { name: "Biobío", aliases: ["Biobio"], cities: [["Concepción", ["Concepción", "Coronel", "Chiguayante", "Florida", "Hualqui", "Lota", "Penco", "San Pedro de la Paz", "Santa Juana", "Talcahuano", "Tomé", "Hualpén"]], ["Arauco", ["Lebu", "Arauco", "Cañete", "Contulmo", "Curanilahue", "Los Álamos", "Tirúa"]], ["Biobío", ["Los Ángeles", "Antuco", "Cabrero", "Laja", "Mulchén", "Nacimiento", "Negrete", "Quilaco", "Quilleco", "San Rosendo", "Santa Bárbara", "Tucapel", "Yumbel", "Alto Biobío"]]] },
  { name: "La Araucanía", aliases: ["La Araucania"], cities: [["Cautín", ["Temuco", "Carahue", "Cunco", "Curarrehue", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche", "Melipeuco", "Nueva Imperial", "Padre Las Casas", "Perquenco", "Pitrufquén", "Pucón", "Saavedra", "Teodoro Schmidt", "Toltén", "Vilcún", "Villarrica", "Cholchol"]], ["Malleco", ["Angol", "Collipulli", "Curacautín", "Ercilla", "Lonquimay", "Los Sauces", "Lumaco", "Purén", "Renaico", "Traiguén", "Victoria"]]] },
  { name: "Los Ríos", aliases: ["Los Rios"], cities: [["Valdivia", ["Valdivia", "Corral", "Lanco", "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli"]], ["Ranco", ["La Unión", "Futrono", "Lago Ranco", "Río Bueno"]]] },
  { name: "Los Lagos", aliases: [], cities: [["Llanquihue", ["Puerto Montt", "Calbuco", "Cochamó", "Fresia", "Frutillar", "Los Muermos", "Llanquihue", "Maullín", "Puerto Varas"]], ["Chiloé", ["Castro", "Ancud", "Chonchi", "Curaco de Vélez", "Dalcahue", "Puqueldón", "Queilén", "Quellón", "Quemchi", "Quinchao"]], ["Osorno", ["Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo"]], ["Palena", ["Chaitén", "Futaleufú", "Hualaihué", "Palena"]]] },
  { name: "Aysén", aliases: ["Aysen", "Aysén del General Carlos Ibáñez del Campo"], cities: [["Coihaique", ["Coyhaique", "Lago Verde"]], ["Aysén", ["Aysén", "Cisnes", "Guaitecas"]], ["Capitán Prat", ["Cochrane", "O'Higgins", "Tortel"]], ["General Carrera", ["Chile Chico", "Río Ibáñez"]]] },
  { name: "Magallanes", aliases: ["Magallanes y de la Antártica Chilena"], cities: [["Magallanes", ["Punta Arenas", "Laguna Blanca", "Río Verde", "San Gregorio"]], ["Antártica Chilena", ["Cabo de Hornos", "Antártica"]], ["Tierra del Fuego", ["Porvenir", "Primavera", "Timaukel"]], ["Última Esperanza", ["Natales", "Torres del Paine"]]] },
];

function lookupKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("es-CL").replace(/[^A-Z0-9]/g, "");
}

function findRegion(region: string): RegionEntry | undefined {
  const key = lookupKey(region);
  return GEOGRAPHY.find((entry) => [entry.name, ...entry.aliases].some((candidate) => lookupKey(candidate) === key));
}

export function listRegions(): string[] {
  return GEOGRAPHY.map((entry) => entry.name);
}

export function listCommunes(region: string): string[] {
  const entry = findRegion(region);
  if (!entry) return [];
  return entry.cities.flatMap(([, communes]) => communes).sort((left, right) => lookupKey(left).localeCompare(lookupKey(right)));
}

export function cityForCommune(region: string, commune: string): string | null {
  const entry = findRegion(region);
  if (!entry) return null;
  const key = lookupKey(commune);
  return entry.cities.find(([, communes]) => communes.some((candidate) => lookupKey(candidate) === key))?.[0] ?? null;
}
