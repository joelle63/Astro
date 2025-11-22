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
/* -----------------------------------------------------------
   BLOC 2 — Temps sidéral + LMT + UTC + obliquité vraie
   -----------------------------------------------------------
   Contient :
   - Temps sidéral à 0h UT (GMST0)
   - Temps sidéral local
   - Conversion heure locale → UTC → LMT
   - Obliquité vraie de l’écliptique (Meeus)
   -----------------------------------------------------------
*/

// Obliquité vraie de l’écliptique (Meeus)
function trueObliquity(jd) {
    let T = (jd - 2451545.0) / 36525;

    // Obliquité moyenne
    let eps0 =
        23 + 26/60 + 21.448/3600
        - (46.8150/3600)*T
        - (0.00059/3600)*T*T
        + (0.001813/3600)*T*T*T;

    // Nutation simple en longitude (approx Meeus)
    // version courte suffisante pour astrologie
    let omega = rad(125.04452 - 1934.136261*T);
    let L = rad(280.4665 + 36000.7698*T);
    let LP = rad(218.3165 + 481267.8813*T);

    let nut = (-17.20 * Math.sin(omega)
               - 1.32 * Math.sin(2*L)
               - 0.23 * Math.sin(2*LP)
               + 0.21 * Math.sin(2*omega)) / 3600;

    return eps0 + nut; // en degrés
}

// Conversion Date → Jour Julien
function dateToJD(dateObj) {
    let Y = dateObj.getUTCFullYear();
    let M = dateObj.getUTCMonth() + 1;
    let D = dateObj.getUTCDate() +
            dateObj.getUTCHours()/24 +
            dateObj.getUTCMinutes()/1440 +
            dateObj.getUTCSeconds()/86400;

    if (M <= 2) {
        Y -= 1;
        M += 12;
    }

    let A = Math.floor(Y / 100);
    let B = 2 - A + Math.floor(A / 4);

    return Math.floor(365.25*(Y + 4716))
         + Math.floor(30.6001*(M + 1))
         + D + B - 1524.5;
}

// GMST à 0h UT
function GMST0(jd) {
    const T = (jd - 2451545.0) / 36525;

    let GMST_sec =
        24110.54841 +
        8640184.812866 * T +
        0.093104 * T*T -
        6.2e-6 * T*T*T;

    GMST_sec = GMST_sec % 86400;
    if (GMST_sec < 0) GMST_sec += 86400;

    return GMST_sec; // secondes
}

// Temps sidéral local
function localSiderealTime(jd, longitudeDeg) {
    let GMST0_sec = GMST0(jd);

    // Heure UT fractionnaire
    let UT = (jd + 0.5) % 1 * 24;

    // GMST = GMST0 + 1.00273790935 * UT * 3600
    let GMST = GMST0_sec + 1.00273790935 * UT * 3600;

    // Ajouter la longitude (en secondes)
    GMST += longitudeDeg * 240; // 1° = 240 sec

    GMST = GMST % 86400;
    if (GMST < 0) GMST += 86400;

    return GMST; // en secondes
}

// Conversion hh:mm locale → UTC
function localToUTC(dateStr, timeStr, offsetMinutes) {
    let [h,m] = timeStr.split(":").map(Number);

    let d = new Date(dateStr + "T00:00:00Z");
    d.setUTCHours(h);
    d.setUTCMinutes(m - offsetMinutes);

    return d;
}

// LMT : heure locale vraie en fonction de la longitude
function computeLMT(utcDate, longitudeDeg) {
    let lmt = new Date(utcDate.getTime() + longitudeDeg * 240 * 1000);
    return lmt;
}

// Export
window.AstroTime = {
    dateToJD,
    GMST0,
    localSiderealTime,
    trueObliquity,
    localToUTC,
    computeLMT
};

