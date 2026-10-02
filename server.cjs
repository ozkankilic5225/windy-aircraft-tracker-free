const http = require("http");

const PORT = process.env.PORT || 3000;


/*
 * WINDY FREE AIRCRAFT TRACKER PROXY
 *
 * Veri kaynağı:
 * adsb.fi
 *
 * Windy -> Render -> adsb.fi
 */


const server = http.createServer(async (req, res) => {

    /*
     * CORS
     * Windy tarayıcısının bu sunucuya
     * erişebilmesi için gerekli.
     */
    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    res.setHeader(
        "Cache-Control",
        "no-store"
    );


    /*
     * CORS preflight
     */
    if (req.method === "OPTIONS") {

        res.writeHead(204);
        res.end();

        return;
    }


    /*
     * Sadece GET
     */
    if (req.method !== "GET") {

        sendJSON(
            res,
            405,
            {
                found: false,
                message:
                    "Sadece GET destekleniyor."
            }
        );

        return;
    }


    try {

        const requestURL =
            new URL(
                req.url,
                `http://${req.headers.host}`
            );


        /*
         * Ana adres:
         *
         * /
         *
         * Render servisinin ayakta
         * olduğunu kontrol eder.
         */
        if (requestURL.pathname === "/") {

            sendJSON(
                res,
                200,
                {
                    status: "ok",
                    service:
                        "windy-aircraft-tracker-free",

                    source:
                        "adsb.fi"
                }
            );

            return;
        }


        /*
         * Uçak sorgusu:
         *
         * /aircraft?callsign=THY6TU
         */
        if (
            requestURL.pathname !==
            "/aircraft"
        ) {

            sendJSON(
                res,
                404,
                {
                    found: false,
                    message:
                        "Endpoint bulunamadı."
                }
            );

            return;
        }


        /*
         * Callsign
         */
        const callsign =
            (
                requestURL
                    .searchParams
                    .get("callsign")
                ||
                ""
            )
                .trim()
                .toUpperCase();


        if (!callsign) {

            sendJSON(
                res,
                400,
                {
                    found: false,
                    message:
                        "Callsign gerekli."
                }
            );

            return;
        }


        /*
         * Basit callsign güvenlik kontrolü
         */
        if (
            !/^[A-Z0-9_-]{2,15}$/
                .test(callsign)
        ) {

            sendJSON(
                res,
                400,
                {
                    found: false,
                    message:
                        "Geçersiz callsign."
                }
            );

            return;
        }


        /*
         * adsb.fi
         *
         * Örnek:
         *
         * https://opendata.adsb.fi/api/v2/callsign/THY6TU
         */
        const apiURL =
            "https://opendata.adsb.fi" +
            "/api/v2/callsign/" +
            encodeURIComponent(callsign);


        console.log(
            `[ADSB.FI] Request: ${callsign}`
        );


        /*
         * 15 saniyelik timeout.
         *
         * Render bağlantısı takılırsa
         * sonsuza kadar beklemesin.
         */
        const controller =
            new AbortController();


        const timeout =
            setTimeout(
                () => controller.abort(),
                15000
            );


        let response;


        try {

            response =
                await fetch(
                    apiURL,
                    {
                        method: "GET",

                        headers: {
                            "Accept":
                                "application/json",

                            "User-Agent":
                                "windy-aircraft-tracker-free/1.0"
                        },

                        signal:
                            controller.signal
                    }
                );

        }

        finally {

            clearTimeout(timeout);
        }


        console.log(
            `[ADSB.FI] HTTP ${response.status}`
        );


        /*
         * adsb.fi HTTP hatası
         */
        if (!response.ok) {

            const errorText =
                await response
                    .text()
                    .catch(() => "");


            console.error(
                `[ADSB.FI] Error:`,
                response.status,
                errorText
            );


            sendJSON(
                res,
                502,
                {
                    found: false,

                    message:
                        `adsb.fi HTTP ${response.status}`
                }
            );

            return;
        }


        /*
         * JSON cevabı
         */
        const data =
            await response.json();


        /*
         * adsb.fi formatı:
         *
         * {
         *     "ac": [
         *         {...}
         *     ],
         *     "total": 1
         * }
         */
        const raw =
            Array.isArray(data.ac)
                ? data.ac[0]
                : null;


        /*
         * Callsign bulunamadı
         */
        if (!raw) {

            sendJSON(
                res,
                200,
                {
                    found: false,

                    message:
                        `${callsign} şu anda adsb.fi verisinde bulunamadı.`
                }
            );

            return;
        }


        /*
         * Pozisyon
         */
        const lat =
            numberOrNull(raw.lat);


        const lon =
            numberOrNull(raw.lon);


        if (
            lat === null ||
            lon === null
        ) {

            sendJSON(
                res,
                200,
                {
                    found: false,

                    message:
                        `${callsign} bulundu fakat güncel pozisyonu yok.`
                }
            );

            return;
        }


        /*
         * İrtifa
         *
         * Öncelik:
         * alt_baro
         *
         * Yedek:
         * alt_geom
         *
         * adsb.fi zaten feet verir.
         */
        const altitudeFt =
            numberOrNull(
                raw.alt_baro
            )
            ??
            numberOrNull(
                raw.alt_geom
            );


        /*
         * Ground speed
         *
         * adsb.fi -> knot
         */
        const groundSpeedKt =
            numberOrNull(
                raw.gs
            );


        /*
         * Track
         *
         * derece
         */
        const trackDeg =
            numberOrNull(
                raw.track
            );


        /*
         * Vertical speed
         *
         * Öncelik:
         * baro_rate
         *
         * Yedek:
         * geom_rate
         *
         * adsb.fi -> ft/min
         */
        const verticalSpeedFpm =
            numberOrNull(
                raw.baro_rate
            )
            ??
            numberOrNull(
                raw.geom_rate
            );


        /*
         * Windy plugin'e sade veri
         */
        const aircraft = {

            callsign:
                String(
                    raw.flight ||
                    callsign
                )
                    .trim(),

            icao24:
                raw.hex || null,

            registration:
                raw.r || null,

            aircraft_type:
                raw.t || null,

            description:
                raw.desc || null,

            lat:
                lat,

            lon:
                lon,

            altitude_ft:
                altitudeFt,

            ground_speed_kt:
                groundSpeedKt,

            track_deg:
                trackDeg,

            vertical_speed_fpm:
                verticalSpeedFpm,

            squawk:
                raw.squawk || null,

            emergency:
                raw.emergency || null,

            seen_seconds:
                numberOrNull(
                    raw.seen
                ),

            seen_position_seconds:
                numberOrNull(
                    raw.seen_pos
                ),

            source:
                "adsb.fi",

            timestamp:
                Date.now()
        };


        console.log(
            `[ADSB.FI] Found ${aircraft.callsign}`,
            aircraft.lat,
            aircraft.lon
        );


        /*
         * Başarılı cevap
         */
        sendJSON(
            res,
            200,
            {
                found: true,
                aircraft: aircraft
            }
        );

    }

    catch (error) {

        console.error(
            "[PROXY ERROR]",
            error
        );


        /*
         * Timeout / abort
         */
        if (
            error &&
            error.name ===
                "AbortError"
        ) {

            sendJSON(
                res,
                504,
                {
                    found: false,

                    message:
                        "adsb.fi bağlantısı zaman aşımına uğradı."
                }
            );

            return;
        }


        /*
         * Diğer sunucu hataları
         */
        sendJSON(
            res,
            500,
            {
                found: false,

                message:
                    "ADS-B verisi alınırken sunucu hatası oluştu."
            }
        );
    }
});


/*
 * Güvenli number kontrolü
 */
function numberOrNull(value) {

    return (
        typeof value === "number" &&
        Number.isFinite(value)
    )
        ? value
        : null;
}


/*
 * JSON cevap yardımcısı
 */
function sendJSON(
    res,
    status,
    data
) {

    res.statusCode =
        status;


    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );


    res.end(
        JSON.stringify(data)
    );
}


/*
 * Render PORT değerini otomatik verir.
 * Bilgisayarda ise 3000 kullanılır.
 */
server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Windy ADS-B proxy running on port ${PORT}`
        );

        console.log(
            "ADS-B source: adsb.fi"
        );
    }
);