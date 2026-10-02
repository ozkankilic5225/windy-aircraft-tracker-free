const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== "GET") {
        sendJSON(res, 405, {
            found: false,
            message: "Sadece GET destekleniyor."
        });
        return;
    }

    try {

        const requestURL = new URL(
            req.url,
            `http://${req.headers.host}`
        );

        // Render ana adresi kontrolü
        if (requestURL.pathname === "/") {

            sendJSON(res, 200, {
                status: "ok",
                service: "windy-aircraft-tracker-free"
            });

            return;
        }

        // Uçak sorgusu:
        // /aircraft?callsign=THY6TU
        if (requestURL.pathname !== "/aircraft") {

            sendJSON(res, 404, {
                found: false,
                message: "Endpoint bulunamadı."
            });

            return;
        }

        const callsign = (
            requestURL.searchParams.get("callsign") || ""
        )
            .trim()
            .toUpperCase();


        if (!callsign) {

            sendJSON(res, 400, {
                found: false,
                message: "Callsign gerekli."
            });

            return;
        }


        if (!/^[A-Z0-9_-]{2,15}$/.test(callsign)) {

            sendJSON(res, 400, {
                found: false,
                message: "Geçersiz callsign."
            });

            return;
        }


        /*
         * OpenSky canlı state vectors
         */
        const response = await fetch(
            "https://opensky-network.org/api/states/all",
            {
                headers: {
                    "Accept": "application/json",
                    "User-Agent":
                        "windy-aircraft-tracker-free/1.0"
                }
            }
        );


        if (!response.ok) {

            sendJSON(res, 502, {
                found: false,
                message:
                    `OpenSky HTTP ${response.status}`
            });

            return;
        }


        const data = await response.json();

        const states =
            Array.isArray(data.states)
                ? data.states
                : [];


        /*
         * OpenSky state vector:
         *
         * 0  = ICAO24
         * 1  = Callsign
         * 2  = Country
         * 5  = Longitude
         * 6  = Latitude
         * 7  = Barometric altitude (m)
         * 8  = On ground
         * 9  = Velocity (m/s)
         * 10 = True track (degrees)
         * 11 = Vertical rate (m/s)
         * 13 = Geometric altitude (m)
         * 14 = Squawk
         */
        const state = states.find((item) => {

            if (!Array.isArray(item)) {
                return false;
            }

            const flight =
                String(item[1] || "")
                    .trim()
                    .toUpperCase();

            return flight === callsign;
        });


        if (!state) {

            sendJSON(res, 200, {
                found: false,
                message:
                    `${callsign} şu anda OpenSky verisinde bulunamadı.`
            });

            return;
        }


        const lon =
            numberOrNull(state[5]);

        const lat =
            numberOrNull(state[6]);


        const altitudeMeters =
            numberOrNull(state[7]) ??
            numberOrNull(state[13]);


        const velocityMS =
            numberOrNull(state[9]);


        const track =
            numberOrNull(state[10]);


        const verticalMS =
            numberOrNull(state[11]);


        if (lat === null || lon === null) {

            sendJSON(res, 200, {
                found: false,
                message:
                    `${callsign} bulundu fakat güncel pozisyonu yok.`
            });

            return;
        }


        /*
         * Birim dönüşümleri
         *
         * metre -> ft
         * m/s   -> knot
         * m/s   -> ft/min
         */
        const altitudeFt =
            altitudeMeters !== null
                ? altitudeMeters * 3.280839895
                : null;


        const groundSpeedKt =
            velocityMS !== null
                ? velocityMS * 1.943844492
                : null;


        const verticalSpeedFpm =
            verticalMS !== null
                ? verticalMS * 196.850394
                : null;


        sendJSON(res, 200, {

            found: true,

            aircraft: {

                callsign:
                    String(state[1] || callsign)
                        .trim(),

                icao24:
                    state[0] || null,

                country:
                    state[2] || null,

                lat: lat,

                lon: lon,

                altitude_ft:
                    altitudeFt,

                ground_speed_kt:
                    groundSpeedKt,

                track_deg:
                    track,

                vertical_speed_fpm:
                    verticalSpeedFpm,

                on_ground:
                    state[8] === true,

                squawk:
                    state[14] || null,

                timestamp:
                    Date.now()
            }
        });

    }

    catch (error) {

        console.error(error);

        sendJSON(res, 500, {
            found: false,
            message:
                "OpenSky verisi alınırken sunucu hatası oluştu."
        });
    }
});


function numberOrNull(value) {

    return (
        typeof value === "number" &&
        Number.isFinite(value)
    )
        ? value
        : null;
}


function sendJSON(res, status, data) {

    res.statusCode = status;

    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );

    res.end(
        JSON.stringify(data)
    );
}


server.listen(PORT, "0.0.0.0", () => {

    console.log(
        `Windy ADS-B proxy running on port ${PORT}`
    );
});