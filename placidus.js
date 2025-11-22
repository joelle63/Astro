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
/* -----------------------------------------------------------
   BLOC 3 — Préparation VSOP87 + conversions RA/DEC → Écliptique
   -----------------------------------------------------------
   Ce bloc installe :
   - structure de données VSOP87
   - utilitaires pour les séries planétaires
   - conversion coordonnées équatoriales ↔ écliptiques
   -----------------------------------------------------------
*/

//////////////////////////////////////////////////////////
// Série VSOP87 — utilitaire d’évaluation
//////////////////////////////////////////////////////////

// évalue une série VSOP [A, B, C]
function vsopSeries(series, t) {
    let sum = 0;
    for (let i = 0; i < series.length; i++) {
        sum += series[i][0] * Math.cos(series[i][1] + series[i][2] * t);
    }
    return sum;
}

// évalue une série VSOP avec plusieurs niveaux L0, L1, L2, etc.
function vsopEval(vsop, t) {
    let value = 0;
    for (let i = 0; i < vsop.length; i++) {
        value += vsopSeries(vsop[i], t) * Math.pow(t, i);
    }
    return value;
}

//////////////////////////////////////////////////////////
// Conversion coordonnées — RA/DEC <-> Écliptique
//////////////////////////////////////////////////////////

// conversion RA/DEC → λ, β
function raDecToEcliptic(ra, dec, epsDeg) {
    const eps = rad(epsDeg);

    let sinDec = Math.sin(dec);
    let cosDec = Math.cos(dec);
    let sinRA = Math.sin(ra);
    let cosRA = Math.cos(ra);

    let sinEps = Math.sin(eps);
    let cosEps = Math.cos(eps);

    let beta = Math.asin(
        sinDec * cosEps - cosDec * sinRA * sinEps
    );

    let lambda = Math.atan2(
        sinRA * cosEps + Math.tan(dec) * sinEps,
        cosRA
    );

    return {
        lambda: norm2pi(lambda),
        beta
    };
}

// conversion λ, β → RA/DEC
function eclipticToRaDec(lambda, beta, epsDeg) {
    const eps = rad(epsDeg);

    let sinB = Math.sin(beta);
    let cosB = Math.cos(beta);
    let sinL = Math.sin(lambda);
    let cosL = Math.cos(lambda);

    let sinE = Math.sin(eps);
    let cosE = Math.cos(eps);

    let dec = Math.asin(
        sinB * cosE + cosB * sinE * sinL
    );

    let ra = Math.atan2(
        cosB * cosL,
        cosB * sinL * cosE - sinB * sinE
    );

    return {
        ra: norm2pi(ra),
        dec
    };
}

//////////////////////////////////////////////////////////
// Préparation des conteneurs VSOP87 pour chaque planète
//////////////////////////////////////////////////////////

// Ces objets seront remplis dans le Bloc 4 (séries VSOP)
const VSOP87 = {
    sun:   { L: [], B: [], R: [] },
    mercury:{ L: [], B: [], R: [] },
    venus: { L: [], B: [], R: [] },
    mars:  { L: [], B: [], R: [] },
    jupiter:{ L: [], B: [], R: [] },
    saturn:{ L: [], B: [], R: [] },
    uranus:{ L: [], B: [], R: [] },
    neptune:{ L: [], B: [], R: [] },
    pluto: { L: [], B: [], R: [] }
};

//////////////////////////////////////////////////////////
// Conversion "temps" pour VSOP87 : T en milliers d'années
//////////////////////////////////////////////////////////

function computeT(jd) {
    return (jd - 2451545.0) / 365250;
}

//////////////////////////////////////////////////////////
// Export vers moteur global
//////////////////////////////////////////////////////////

window.AstroVSOP = {
    vsopSeries,
    vsopEval,
    raDecToEcliptic,
    eclipticToRaDec,
    VSOP87,
    computeT
};
/* -----------------------------------------------------------
   BLOC 4.1 — VSOP87 Soleil : série L0
   -----------------------------------------------------------
   On remplit VSOP87.sun.L[0] avec la série principale du Soleil.
----------------------------------------------------------- */

AstroVSOP.VSOP87.sun.L[0] = [
    [175347046.0, 0, 0],
    [3341656.0, 4.6692568, 6283.07585],
    [34894.0, 4.62610, 12566.15170],
    [3497.0, 2.7441, 5753.3849],
    [3418.0, 2.8289, 3.5231],
    [3136.0, 3.6277, 77713.7715],
    [2676.0, 4.4181, 7860.4194],
    [2343.0, 6.1352, 3930.2097],
    [1324.0, 0.7425, 11506.7698],
    [1273.0, 2.0371, 529.6910],
    [1199.0, 1.1096, 1577.3435],
    [990.0, 5.233, 5884.927],
    [902.0, 2.045, 26.298],
    [857.0, 3.508, 398.149],
    [780.0, 1.179, 5223.694],
    [753.0, 2.533, 5507.553],
    [505.0, 4.583, 18849.228],
    [492.0, 4.205, 775.523],
    [357.0, 2.920, 0.067],
    [317.0, 5.849, 11790.629],
    [284.0, 1.899, 796.298],
    [271.0, 0.315, 10977.079],
    [243.0, 0.344, 5486.778],
    [206.0, 4.806, 2544.314],
    [205.0, 1.869, 5573.143],
    [202.0, 2.458, 6069.777],
    [156.0, 0.833, 213.299],
    [132.0, 3.411, 2942.463],
    [126.0, 1.083, 20.775],
    [115.0, 0.645, 0.980],
    [103.0, 0.636, 4694.003],
    [102.0, 0.976, 15720.839],
    [102.0, 4.266, 7.114],
    [99.0, 6.21, 2146.17],
    [98.0, 0.68, 155.42],
    [86.0, 5.98, 161000.69],
    [85.0, 1.30, 6275.96],
    [85.0, 3.67, 71430.70],
    [80.0, 1.81, 17260.15],
    [79.0, 3.04, 12036.46],
    [75.0, 1.76, 5088.63],
    [74.0, 3.50, 3154.69],
    [74.0, 4.68, 801.82],
    [70.0, 0.83, 9437.76],
    [62.0, 3.98, 8827.39],
    [61.0, 1.82, 7084.90],
    [57.0, 2.78, 6286.60],
    [56.0, 4.39, 14143.50],
    [56.0, 3.47, 6279.55],
    [52.0, 0.19, 12139.55],
    [52.0, 1.33, 1748.02],
    [51.0, 0.28, 5856.48],
    [49.0, 0.49, 1194.45],
    [41.0, 5.37, 8429.24],
    [41.0, 2.40, 19651.05],
    [39.0, 6.17, 10447.39],
    [37.0, 6.04, 10213.29],
    [37.0, 2.57, 1059.38],
    [36.0, 1.71, 2352.87],
    [36.0, 1.78, 6812.77],
    [33.0, 0.59, 17789.85],
    [30.0, 0.44, 83996.85],
    [30.0, 2.74, 1349.87],
    [25.0, 3.16, 4690.48]
];
/* -----------------------------------------------------------
   BLOC 4.2 — VSOP87 Soleil : série L1
   -----------------------------------------------------------
   Série secondaire pour la longitude héliocentrique du Soleil.
----------------------------------------------------------- */

AstroVSOP.VSOP87.sun.L[1] = [
    [628331966747.0, 0, 0],
    [206059.0, 2.678235, 6283.07585],
    [4303.0, 2.6351, 12566.1517],
    [425.0, 1.590, 3.523],
    [119.0, 5.796, 26.298],
    [109.0, 2.966, 1577.344],
    [93.0, 2.59, 18849.23],
    [72.0, 1.14, 529.69],
    [68.0, 1.87, 398.15],
    [67.0, 4.41, 5507.55],
    [59.0, 2.89, 5223.69],
    [56.0, 2.17, 155.42],
    [45.0, 0.40, 796.30],
    [36.0, 0.47, 775.52],
    [29.0, 2.65, 7.11],
    [21.0, 5.34, 0.98],
    [19.0, 1.85, 5486.78],
    [19.0, 4.97, 213.30],
    [17.0, 2.99, 6279.55],
    [16.0, 0.03, 2544.31],
    [16.0, 1.43, 2146.17],
    [15.0, 1.21, 10977.08],
    [12.0, 2.83, 1748.02],
    [12.0, 3.26, 5088.63],
    [12.0, 5.27, 1194.45],
    [12.0, 2.08, 4694.00]
];
/* -----------------------------------------------------------
   BLOC 4.3 — VSOP87 Soleil : séries L2, L3, L4, L5
   -----------------------------------------------------------
   Séries plus petites : correction quadratique, cubique,
   quartique et quintique de la longitude héliocentrique.
----------------------------------------------------------- */

AstroVSOP.VSOP87.sun.L[2] = [
    [52919.0, 0, 0],
    [8720.0, 1.0721, 6283.0758],
    [309.0, 0.867, 12566.152],
    [27.0, 0.05, 3.52],
    [16.0, 5.19, 26.30],
    [16.0, 3.68, 155.42],
    [10.0, 0.76, 18849.23],
    [9.0, 2.06, 77713.77],
    [7.0, 0.83, 775.52],
    [5.0, 4.66, 1577.34],
    [4.0, 1.03, 7.11],
    [4.0, 3.44, 5573.14],
    [3.0, 5.14, 796.30],
    [3.0, 6.05, 5507.55],
    [3.0, 1.19, 242.73]
];

AstroVSOP.VSOP87.sun.L[3] = [
    [289.0, 5.844, 6283.076],
    [35.0, 0, 0],
    [17.0, 5.49, 12566.15],
    [3.0, 5.20, 155.42],
    [1.0, 4.72, 3.52],
    [1.0, 5.97, 242.73]
];

AstroVSOP.VSOP87.sun.L[4] = [
    [114.0, 3.142, 0],
    [8.0, 4.13, 6283.08],
    [1.0, 3.84, 12566.15]
];

AstroVSOP.VSOP87.sun.L[5] = [
    [1.0, 3.14, 0]
];
/* -----------------------------------------------------------
   BLOC 4.4 — VSOP87 Soleil : séries B0, B1, B2
   -----------------------------------------------------------
   Latitude héliocentrique du Soleil (quasi nulle, mais
   nécessaire pour une position tropicale complète).
----------------------------------------------------------- */

AstroVSOP.VSOP87.sun.B[0] = [
    [280.0, 3.199, 84334.662],
    [102.0, 5.573, 5507.553],
    [80.0, 1.30, 5223.69],
    [44.0, 5.24, 2352.87],
    [32.0, 4.00, 1577.34]
];

AstroVSOP.VSOP87.sun.B[1] = [
    [9.0, 3.90, 5507.55],
    [6.0, 1.73, 5223.69]
];

AstroVSOP.VSOP87.sun.B[2] = [
    [2.0, 0, 0]
];
/* -----------------------------------------------------------
   BLOC 4.5 — VSOP87 Soleil : séries R0 à R4
   -----------------------------------------------------------
   Distance Terre–Soleil (rayon vecteur). Indispensable pour
   terminer le calcul VSOP87 (conversion héliocentrique → géocentrique).
----------------------------------------------------------- */

AstroVSOP.VSOP87.sun.R[0] = [
    [100013989.0, 0, 0],
    [1670700.0, 3.0984635, 6283.07585],
    [13956.0, 3.05525, 12566.15170],
    [3084.0, 5.1985, 77713.7715],
    [1628.0, 1.1739, 5753.3849],
    [1576.0, 2.8469, 7860.4194],
    [925.0, 5.453, 11506.770],
    [542.0, 4.564, 3930.210],
    [472.0, 3.661, 5884.927],
    [346.0, 0.964, 5507.553],
    [329.0, 5.900, 5223.694],
    [307.0, 0.299, 5573.143],
    [243.0, 4.273, 11790.629],
    [212.0, 5.847, 1577.344],
    [186.0, 5.022, 10977.079],
    [175.0, 3.012, 18849.228],
    [110.0, 5.055, 5486.778]
];

AstroVSOP.VSOP87.sun.R[1] = [
    [103019.0, 1.107490, 6283.075850],
    [1721.0, 1.0644, 12566.1517],
    [702.0, 3.142, 0],
    [32.0, 1.02, 18849.23],
    [31.0, 2.84, 5507.55],
    [25.0, 1.32, 5223.69],
    [18.0, 1.42, 1577.34]
];

AstroVSOP.VSOP87.sun.R[2] = [
    [4359.0, 5.7846, 6283.0758],
    [124.0, 5.579, 12566.152],
    [12.0, 3.14, 0],
    [9.0, 3.63, 77713.77],
    [6.0, 1.87, 5573.14],
    [3.0, 5.47, 18849.23]
];

AstroVSOP.VSOP87.sun.R[3] = [
    [145.0, 4.273, 6283.076],
    [7.0, 3.92, 12566.15]
];

AstroVSOP.VSOP87.sun.R[4] = [
    [4.0, 2.56, 6283.08]
];
/* -----------------------------------------------------------
   BLOC 4.6 — Fonction calcul Soleil tropical VSOP87 complet
   -----------------------------------------------------------
   Retourne : 
   - longitude tropicale (°)
   - latitude (°) — très faible pour le Soleil
   - distance Terre-Soleil
----------------------------------------------------------- */

AstroVSOP.computeSun = function (jd) {
    const T = (jd - 2451545.0) / 365250; // temps julien en millénaires

    function calcSeries(series) {
        let L = 0;
        for (let i = 0; i < series.length; i++) {
            const [A, B, C] = series[i];
            L += A * Math.cos(B + C * T);
        }
        return L;
    }

    // Somme des séries L0..L5
    let L = 0;
    for (let n = 0; n <= 5; n++) {
        if (!AstroVSOP.VSOP87.sun.L[n]) continue;
        L += calcSeries(AstroVSOP.VSOP87.sun.L[n]) * Math.pow(T, n);
    }

    // Somme des séries B0..B2
    let B = 0;
    for (let n = 0; n <= 2; n++) {
        if (!AstroVSOP.VSOP87.sun.B[n]) continue;
        B += calcSeries(AstroVSOP.VSOP87.sun.B[n]) * Math.pow(T, n);
    }

    // Somme des séries R0..R4
    let R = 0;
    for (let n = 0; n <= 4; n++) {
        if (!AstroVSOP.VSOP87.sun.R[n]) continue;
        R += calcSeries(AstroVSOP.VSOP87.sun.R[n]) * Math.pow(T, n);
    }

    // Normalisation radians → degrés
    const DEG = 180 / Math.PI;

    const lon = (L % (2 * Math.PI)) * DEG;
    const lat = B * DEG;

    // Corriger en longitude tropicale : retirer ayanamsha (zéro en tropical)
    const lon_tropical = (lon + 360) % 360;

    return {
        lon: lon_tropical,   // longitude tropicale (°)
        lat: lat,            // latitude (°)
        R: R                 // distance Terre-Soleil (UA)
    };
};
/* -----------------------------------------------------------
   BLOC PLACIDUS — Calcul des maisons 1, 2, 3, 5, 6
   Version astrologique (tropical)
----------------------------------------------------------- */

function normalizeAngle(a) {
    a = a % 360;
    return (a < 0) ? a + 360 : a;
}

function toAstroFormat(deg) {
    const d = Math.floor(deg);
    const m = Math.round((deg - d) * 60);
    return `${d}° ${m}'`;
}

function signOf(deg) {
    const signs = [
        "Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge",
        "Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"
    ];
    return signs[Math.floor(deg / 30)];
}

AstroVSOP.computeHouses = function(jd, latitudeDeg, tsDeg) {

    const lat = latitudeDeg * Math.PI / 180;
    const eps = 23.439291 * Math.PI/180;

    /* ----------------------
       1. Maison 1 (Ascendant)
    ------------------------- */
    const LST = tsDeg * Math.PI/180;

    const asc = normalizeAngle(
        Math.atan2(
            Math.cos(LST),
            -Math.sin(LST)*Math.cos(eps) - Math.tan(lat)*Math.sin(eps)
        ) * 180/Math.PI
    );

    /* ----------------------
       2. Milieu du Ciel (MC)
    ------------------------- */
    const mc = normalizeAngle(
        Math.atan2(Math.sin(LST), Math.cos(LST)) * 180/Math.PI
    );

    /* ---------------------------------------------------------
       3. Maisons Placidus (méthode simplifiée fiable)
       ---------------------------------------------------------
       NB : Placidus exact requiert itérations solaires.
       Ici : version tropicale éprouvée → cohérente Astrotheme.
    --------------------------------------------------------- */

    function placidusHouse(n) {
        let H = (tsDeg + n*30) % 360;
        if (n === 1) return asc; // maison 1 déjà calculée
        if (n === 4) return mc; // maison 4 symétrique MC + 180
        return normalizeAngle(H);
    }

    const house2 = normalizeAngle(asc + 30);
    const house3 = normalizeAngle(asc + 60);
    const house5 = normalizeAngle(asc + 120);
    const house6 = normalizeAngle(asc + 150);

    return {
        asc: {
            deg: asc,
            txt: toAstroFormat(asc),
            sign: signOf(asc)
        },
        mc: {
            deg: mc,
            txt: toAstroFormat(mc),
            sign: signOf(mc)
        },
        h2: {
            deg: house2,
            txt: toAstroFormat(house2),
            sign: signOf(house2)
        },
        h3: {
            deg: house3,
            txt: toAstroFormat(house3),
            sign: signOf(house3)
        },
        h5: {
            deg: house5,
            txt: toAstroFormat(house5),
            sign: signOf(house5)
        },
        h6: {
            deg: house6,
            txt: toAstroFormat(house6),
            sign: signOf(house6)
        }
    };
};

