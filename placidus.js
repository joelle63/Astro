/* -----------------------------------------------------------
   BLOC 1 — Fonctions mathématiques + conversions + signes
   -----------------------------------------------------------
   Ce bloc contient :
   - conversions degrés ↔ radians
   - normalisation des angles
   - conversion en degrés/minutes
   - détermination du signe astrologique
   -----------------------------------------------------------
*/

//////////////////////////////
// Conversion radians <-> degrés
//////////////////////////////

function rad(deg) {
    return deg * Math.PI / 180;
}

function deg(rad) {
    return rad * 180 / Math.PI;
}

//////////////////////////////
// Normalisation : ramener un angle dans [0,360[
//////////////////////////////

function norm360(angle) {
    angle = angle % 360;
    if (angle < 0) angle += 360;
    return angle;
}

//////////////////////////////
// Normalisation : ramener un angle dans [0,2π[
//////////////////////////////

function norm2pi(angle) {
    angle = angle % (2 * Math.PI);
    if (angle < 0) angle += 2 * Math.PI;
    return angle;
}

//////////////////////////////
// Conversion degré → degré + minute
//////////////////////////////

function degToDMS(angle) {
    let d = Math.floor(angle);
    let m = Math.round((angle - d) * 60);

    if (m === 60) {
        m = 0;
        d += 1;
    }

    return { deg: d, min: m };
}

//////////////////////////////
// Signes astrologiques
//////////////////////////////

const signes = [
    "Bélier", "Taureau", "Gémeaux", "Cancer",
    "Lion", "Vierge", "Balance", "Scorpion",
    "Sagittaire", "Capricorne", "Verseau", "Poissons"
];

function getZodiacSign(angle) {
    // angle en degrés 0 à 360
    const index = Math.floor(angle / 30);
    return signes[index];
}

//////////////////////////////
// Formattage astrologique final
//////////////////////////////

function formatAstro(angle) {
    angle = norm360(angle);
    const dms = degToDMS(angle);
    const sign = getZodiacSign(angle);

    // position dans le signe
    let pos = angle % 30;
    let p = degToDMS(pos);

    return `${p.deg}°${String(p.min).padStart(2,'0')}' ${sign}`;
}

//////////////////////////////
// Export global
//////////////////////////////

// Pour conserver la compatibilité future :
window.AstroTools = {
    rad,
    deg,
    norm360,
    norm2pi,
    degToDMS,
    getZodiacSign,
    formatAstro
};

