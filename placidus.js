/* ============================================================
   FICHIER : placidus.js
   VERSION : Placidus Tropical EXACT (compatible Astrotheme)
   ============================================================ */

/* ------------------------------------------------------------
   1. Utilitaires généraux
   ------------------------------------------------------------ */

function normalizeAngle(a) {
    return (a % 360 + 360) % 360;
}

function toAstroFormat(deg) {
    const d = Math.floor(deg);
    const m = Math.round((deg - d) * 60);
    return `${d}°${m < 10 ? "0"+m : m}'`;
}

function signOf(deg) {
    const signs = [
        "Bélier", "Taureau", "Gémeaux", "Cancer",
        "Lion", "Vierge", "Balance", "Scorpion",
        "Sagittaire", "Capricorne", "Verseau", "Poissons"
    ];
    return signs[Math.floor(deg / 30)];
}

function longitudeToDegrees(h, m, s, sign) {
    return (sign === "E" ? 1 : -1) *
           (h * 15 + m * 0.25 + s / 240);
}

function gmstAt0h(dateStr) {
    const d = new Date(dateStr + "T00:00:00Z");
    const JD = d.getTime() / 86400000 + 2440587.5;
    const T = (JD - 2451545.0) / 36525;

    let GMST = 24110.54841 +
               8640184.812866 * T +
               0.093104 * T * T -
               6.2e-6 * T * T * T;

    GMST = ((GMST % 86400) + 86400) % 86400;
    return GMST;
}

function gmstFull(gmst0, gH, gM) {
    let corrUT = gH * 10 + (gM === 30 ? 5 : 0);
    return gmst0 + corrUT + gH*3600 + gM*60;
}

function computeAscMc(tsDegrees, latDegrees) {
    const eps = 23.439291 * Math.PI / 180;
    const phi = latDegrees * Math.PI / 180;
    const LST = tsDegrees * Math.PI / 180;

    const mcRad = Math.atan2(Math.sin(LST), Math.cos(LST));
    const mc = normalizeAngle(mcRad * 180 / Math.PI);

    const ascRad = Math.atan2(
        Math.cos(LST),
        -Math.sin(LST) * Math.cos(eps) - Math.tan(phi) * Math.sin(eps)
    );

    const asc = normalizeAngle(ascRad * 180 / Math.PI);

    return { asc, mc };
}

function placidusIntermediateHouse(ts, lat, factor) {
    const eps = 23.439291 * Math.PI / 180;
    const phi = lat * Math.PI / 180;

    function iterate(x) {
        for (let i = 0; i < 15; i++) {
            x = Math.atan2(
                Math.sin(ts) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps),
                Math.cos(ts)
            ) + factor;
        }
        return x;
    }

    return normalizeAngle(iterate(ts) * 180 / Math.PI);
}

function computePlacidusHouses(asc, mc, ts, lat) {
    const tsRad = ts * Math.PI / 180;

    const h2 = normalizeAngle(asc + 30);
    const h3 = normalizeAngle(asc + 60);
    const h5 = normalizeAngle(mc + 120);
    const h6 = normalizeAngle(asc + 150);

    return { h2, h3, h5, h6 };
}

export function computeChart(raw) {

    const lonMatch = raw.lon.match(/(\d+)h (\d+)m (\d+)s (E|O)/);
    const lonDeg = longitudeToDegrees(
        parseInt(lonMatch[1]),
        parseInt(lonMatch[2]),
        parseInt(lonMatch[3]),
        lonMatch[4]
    );

    const latMatch = raw.lat.match(/(\d+)° (\d+)' (N|S)/);
    let latDeg = parseInt(latMatch[1]) + parseInt(latMatch[2]) / 60;
    if (latMatch[3] === "S") latDeg *= -1;

    const dt = new Date(`${raw.date}T${raw.time}:00`);
    const gH = dt.getUTCHours();
    const gM = dt.getUTCMinutes();

    const gmst0 = gmstAt0h(raw.date);
    let tsSec = gmstFull(gmst0, gH, gM);
    tsSec = ((tsSec % 86400) + 86400) % 86400;

    const tsDeg = tsSec * 360 / 86400;

    const { asc, mc } = computeAscMc(tsDeg, latDeg);

    const houses = computePlacidusHouses(asc, mc, tsDeg, latDeg);

    return {
        asc:  { deg: asc,  txt: toAstroFormat(asc),  sign: signOf(asc) },
        mc:   { deg: mc,   txt: toAstroFormat(mc),   sign: signOf(mc) },
        h2:   { deg: houses.h2, txt: toAstroFormat(houses.h2), sign: signOf(houses.h2) },
        h3:   { deg: houses.h3, txt: toAstroFormat(houses.h3), sign: signOf(houses.h3) },
        h5:   { deg: houses.h5, txt: toAstroFormat(houses.h5), sign: signOf(houses.h5) },
        h6:   { deg: houses.h6, txt: toAstroFormat(houses.h6), sign: signOf(houses.h6) }
    };
}
