<div class="plugin__mobile-header">
    âœˆï¸ Ãœcretsiz UÃ§ak Takip
</div>

<section class="plugin__content">
    <div class="tracker">

        <div class="search">
            <input
                bind:value={callsign}
                placeholder="Ã–rn. AKINCI1453"
                on:keydown={(e) => e.key === "Enter" && startTracking()}
            />

            <button
                on:click={startTracking}
                disabled={loading}
            >
                {loading ? "AranÄ±yor..." : "Takip Et"}
            </button>
        </div>

        {#if error}
            <div class="error">
                {error}
            </div>
        {/if}

        {#if aircraft}
            <div class="card">

                <div class="title">
                    <strong>
                        âœˆï¸ {aircraft.callsign}
                    </strong>

                    {#if aircraft.registration}
                        <span class="registration">
                            {aircraft.registration}
                        </span>
                    {/if}
                </div>

                <div class="row">
                    <span>Ä°rtifa</span>
                    <b>{formatNumber(aircraft.altitude_ft, " ft")}</b>
                </div>

                <div class="row">
                    <span>Yer hÄ±zÄ±</span>
                    <b>{formatNumber(aircraft.ground_speed_kt, " kt")}</b>
                </div>

                <div class="row">
                    <span>YÃ¶n</span>
                    <b>{formatTrack(aircraft.track_deg)}</b>
                </div>

                <div class="row">
                    <span>Dikey hÄ±z</span>
                    <b>{formatVerticalSpeed(aircraft.vertical_speed_fpm)}</b>
                </div>

                {#if aircraft.aircraft_type}
                    <div class="row">
                        <span>UÃ§ak</span>
                        <b>{aircraft.aircraft_type}</b>
                    </div>
                {/if}

                <div class="live">
                    â— CANLI ADS-B â€¢ 10 sn
                </div>

            </div>
        {/if}

    </div>
</section>


<script lang="ts">

    import { map } from "@windy/map";
    import { onDestroy } from "svelte";


    /*
     * Ã‡ALIÅAN RENDER PROXY
     */
    const API_BASE =
        "https://windy-aircraft-tracker-free.onrender.com/aircraft?callsign=";


    /*
     * GerÃ§ek ADS-B sorgusu:
     * 10 saniyede bir.
     */
    const UPDATE_INTERVAL =
        10000;


    /*
     * Ä°ki gerÃ§ek pozisyon arasÄ±nda
     * akÄ±cÄ± hareket sÃ¼resi.
     */
    const ANIMATION_DURATION =
        9500;


    /*
     * Ä°z ne sÄ±klÄ±kta gÃ¼ncellensin.
     */
    const TRAIL_UPDATE_INTERVAL =
        200;


    /*
     * PNG artÄ±k import edilmiyor.
     * localhost:9999 dist klasÃ¶rÃ¼nÃ¼
     * servis ediyor.
     */
    const AIRCRAFT_ICON_URL =
        "data:image/png;base64,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";


    let callsign =
        "";


    let aircraft: any =
        null;


    let error =
        "";


    let loading =
        false;


    let timer:
        ReturnType<typeof setInterval> |
        null =
        null;


    let aircraftMarker:
        L.Marker |
        null =
        null;


    let trailLine:
        L.Polyline |
        null =
        null;


    let trailPoints:
        L.LatLngExpression[] =
        [];


    let firstPosition =
        true;


    let animationFrame:
        number |
        null =
        null;


    let lastTrailUpdate =
        0;


    /*
     * CALLSIGN TEMÄ°ZLE
     */
    function cleanCallsign(
        value: string
    ) {

        return value
            .trim()
            .toUpperCase();
    }


    /*
     * HTML GÃœVENLÄ°ÄÄ°
     */
    function escapeHtml(
        value: string
    ) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /*
     * UÃ‡AK Ä°KONU
     *
     * PNG'nin burnu yukarÄ± bakÄ±yor.
     *
     * ADS-B:
     * 0Â°   = KUZEY
     * 90Â°  = DOÄU
     * 180Â° = GÃœNEY
     * 270Â° = BATI
     *
     * Bu yÃ¼zden track aÃ§Ä±sÄ±nÄ±
     * doÄŸrudan kullanÄ±yoruz.
     */
    function createAircraftIcon(
        track: number,
        label: string
    ) {

        const heading =
            Number.isFinite(track)
                ? ((track % 360) + 360) % 360
                : 0;


        return L.divIcon({

            className:
                "aircraft-marker-wrapper",


            html: `
                <div class="aircraft-map-marker">

                    <img
                        class="aircraft-plane-image"
                        src="${AIRCRAFT_ICON_URL}"
                        alt=""
                        style="
                            transform:
                            translate(-50%, -50%)
                            rotate(${heading}deg);
                        "
                    />

                    <div class="aircraft-label">
                        ${escapeHtml(label)}
                    </div>

                </div>
            `,


            /*
             * Marker kutusu.
             */
            iconSize:
                [120, 100],


            /*
             * GerÃ§ek ADS-B koordinatÄ±
             * marker kutusunun merkezi.
             */
            iconAnchor:
                [60, 50]
        });
    }


    /*
     * AKTÄ°F ANÄ°MASYONU DURDUR
     */
    function stopAnimation() {

        if (
            animationFrame !== null
        ) {

            cancelAnimationFrame(
                animationFrame
            );


            animationFrame =
                null;
        }
    }


    /*
     * Ä°ZÄ° OLUÅTUR
     */
    function createTrail(
        lat: number,
        lon: number
    ) {

        trailPoints =
            [
                [lat, lon]
            ];


        trailLine =
            L.polyline(
                trailPoints,
                {
                    weight:
                        3,

                    opacity:
                        0.85,

                    lineCap:
                        "round",

                    lineJoin:
                        "round",

                    interactive:
                        false
                }
            )
            .addTo(map);


        /*
         * Ä°z uÃ§ak ikonunun altÄ±nda.
         */
        trailLine.bringToBack();
    }


    /*
     * Ä°ZE YENÄ° NOKTA EKLE
     */
    function addTrailPoint(
        lat: number,
        lon: number
    ) {

        if (!trailLine) {

            createTrail(
                lat,
                lon
            );

            return;
        }


        const last =
            trailPoints.length > 0
                ? trailPoints[
                    trailPoints.length - 1
                ]
                : null;


        /*
         * AynÄ± koordinatÄ± gereksiz
         * yere tekrar ekleme.
         */
        if (
            Array.isArray(last)
            &&
            Math.abs(
                Number(last[0]) - lat
            ) < 0.000001
            &&
            Math.abs(
                Number(last[1]) - lon
            ) < 0.000001
        ) {

            return;
        }


        trailPoints.push(
            [lat, lon]
        );


        trailLine.setLatLngs(
            trailPoints
        );
    }


    /*
     * MARKERI YUMUÅAK HAREKET ETTÄ°R
     */
    function animateMarker(
        targetLat: number,
        targetLon: number
    ) {

        if (!aircraftMarker) {
            return;
        }


        stopAnimation();


        const current =
            aircraftMarker.getLatLng();


        const startLat =
            current.lat;


        const startLon =
            current.lng;


        const deltaLat =
            targetLat - startLat;


        const deltaLon =
            targetLon - startLon;


        /*
         * UÃ§ak aynÄ± konumdaysa.
         */
        if (
            Math.abs(deltaLat) < 0.0000001
            &&
            Math.abs(deltaLon) < 0.0000001
        ) {

            aircraftMarker.setLatLng(
                [
                    targetLat,
                    targetLon
                ]
            );


            addTrailPoint(
                targetLat,
                targetLon
            );


            return;
        }


        const startTime =
            performance.now();


        lastTrailUpdate =
            startTime;


        function step(
            now: number
        ) {

            if (!aircraftMarker) {
                return;
            }


            const elapsed =
                now - startTime;


            const progress =
                Math.min(
                    elapsed /
                    ANIMATION_DURATION,
                    1
                );


            const lat =
                startLat +
                deltaLat *
                progress;


            const lon =
                startLon +
                deltaLon *
                progress;


            /*
             * Marker yeni ara konuma.
             */
            aircraftMarker.setLatLng(
                [
                    lat,
                    lon
                ]
            );


            /*
             * Ä°z de uÃ§akla beraber
             * canlÄ± ÅŸekilde uzar.
             */
            if (
                now -
                lastTrailUpdate
                >=
                TRAIL_UPDATE_INTERVAL
            ) {

                addTrailPoint(
                    lat,
                    lon
                );


                lastTrailUpdate =
                    now;
            }


            if (
                progress < 1
            ) {

                animationFrame =
                    requestAnimationFrame(
                        step
                    );

            } else {

                animationFrame =
                    null;


                aircraftMarker.setLatLng(
                    [
                        targetLat,
                        targetLon
                    ]
                );


                addTrailPoint(
                    targetLat,
                    targetLon
                );
            }
        }


        animationFrame =
            requestAnimationFrame(
                step
            );
    }


    /*
     * HARÄ°TADA UÃ‡AÄI GÃ–STER
     */
    function showAircraftOnMap(
        data: any
    ) {

        if (
            !Number.isFinite(data.lat)
            ||
            !Number.isFinite(data.lon)
        ) {

            return;
        }


        const label =
            data.callsign ||
            callsign;


        const track =
            Number(
                data.track_deg
            );


        /*
         * Ä°LK POZÄ°SYON
         */
        if (!aircraftMarker) {

            aircraftMarker =
                L.marker(
                    [
                        data.lat,
                        data.lon
                    ],
                    {
                        icon:
                            createAircraftIcon(
                                track,
                                label
                            ),

                        zIndexOffset:
                            10000
                    }
                )
                .addTo(map);


            /*
             * Ä°z tam burada baÅŸlar.
             */
            createTrail(
                data.lat,
                data.lon
            );


            /*
             * HaritayÄ± yalnÄ±zca ilk
             * pozisyonda uÃ§aÄŸa gÃ¶tÃ¼r.
             */
            if (
                firstPosition
            ) {

                map.setView(
                    [
                        data.lat,
                        data.lon
                    ],
                    8
                );


                firstPosition =
                    false;
            }


            return;
        }


        /*
         * Yeni ADS-B heading/track
         * deÄŸerine gÃ¶re PNG'yi dÃ¶ndÃ¼r.
         */
        aircraftMarker.setIcon(
            createAircraftIcon(
                track,
                label
            )
        );


        /*
         * Yeni gerÃ§ek pozisyona
         * yumuÅŸak hareket.
         */
        animateMarker(
            data.lat,
            data.lon
        );
    }


    /*
     * CANLI VERÄ°YÄ° AL
     */
    async function fetchAircraft() {

        const wanted =
            cleanCallsign(
                callsign
            );


        if (!wanted) {

            error =
                "LÃ¼tfen bir callsign yaz.";

            return;
        }


        try {

            const response =
                await fetch(
                    `${API_BASE}${encodeURIComponent(wanted)}`,
                    {
                        cache:
                            "no-store"
                    }
                );


            /*
             * Render hata cevabÄ±.
             */
            if (!response.ok) {

                let message =
                    `HTTP ${response.status}`;


                try {

                    const body =
                        await response.json();


                    if (
                        body.message
                    ) {

                        message =
                            body.message;
                    }

                } catch (_) {}


                throw new Error(
                    message
                );
            }


            const data =
                await response.json();


            /*
             * UÃ§ak bulunamadÄ±.
             */
            if (
                !data.found
                ||
                !data.aircraft
            ) {

                error =
                    data.message ||
                    `${wanted} ÅŸu anda bulunamadÄ±.`;

                return;
            }


            const next =
                data.aircraft;


            /*
             * LAT / LON SAYIYA
             */
            next.lat =
                Number(
                    next.lat
                );


            next.lon =
                Number(
                    next.lon
                );


            if (
                !Number.isFinite(
                    next.lat
                )
                ||
                !Number.isFinite(
                    next.lon
                )
            ) {

                error =
                    `${wanted} bulundu fakat gÃ¼ncel konumu yok.`;

                return;
            }


            /*
             * TRACK SAYIYA
             */
            if (
                next.track_deg !== null
                &&
                next.track_deg !== undefined
            ) {

                next.track_deg =
                    Number(
                        next.track_deg
                    );
            }


            aircraft =
                next;


            error =
                "";


            showAircraftOnMap(
                next
            );

        }

        catch (e) {

            console.error(
                e
            );


            error =
                "CanlÄ± ADS-B verisi alÄ±namadÄ±.";
        }
    }


    /*
     * TAKÄ°BÄ° BAÅLAT
     */
    async function startTracking() {

        const wanted =
            cleanCallsign(
                callsign
            );


        if (!wanted) {

            error =
                "LÃ¼tfen bir callsign yaz.";

            return;
        }


        callsign =
            wanted;


        loading =
            true;


        error =
            "";


        /*
         * Eski timer.
         */
        if (timer) {

            clearInterval(
                timer
            );


            timer =
                null;
        }


        /*
         * Eski animasyon.
         */
        stopAnimation();


        /*
         * Eski uÃ§ak.
         */
        if (
            aircraftMarker
        ) {

            aircraftMarker.remove();


            aircraftMarker =
                null;
        }


        /*
         * Eski iz.
         */
        if (
            trailLine
        ) {

            trailLine.remove();


            trailLine =
                null;
        }


        trailPoints =
            [];


        aircraft =
            null;


        firstPosition =
            true;


        /*
         * Ä°lk veriyi hemen al.
         */
        await fetchAircraft();


        loading =
            false;


        /*
         * 10 saniyede bir
         * gerÃ§ek ADS-B gÃ¼ncellemesi.
         */
        timer =
            setInterval(
                fetchAircraft,
                UPDATE_INTERVAL
            );
    }


    /*
     * SAYI FORMATLA
     */
    function formatNumber(
        value: any,
        suffix: string
    ) {

        const n =
            Number(
                value
            );


        return Number.isFinite(n)

            ? `${Math.round(n)
                .toLocaleString("tr-TR")}${suffix}`

            : "â€”";
    }


    /*
     * TRACK FORMATLA
     */
    function formatTrack(
        value: any
    ) {

        const n =
            Number(
                value
            );


        if (
            !Number.isFinite(n)
        ) {

            return "â€”";
        }


        const normalized =
            ((n % 360) + 360) % 360;


        return `${Math.round(normalized)}Â°`;
    }


    /*
     * DÄ°KEY HIZ
     */
    function formatVerticalSpeed(
        value: any
    ) {

        const n =
            Number(
                value
            );


        if (
            !Number.isFinite(n)
        ) {

            return "â€”";
        }


        const rounded =
            Math.round(
                n
            );


        if (
            rounded > 0
        ) {

            return (
                `â†‘ ${rounded.toLocaleString("tr-TR")} ft/min`
            );
        }


        if (
            rounded < 0
        ) {

            return (
                `â†“ ${Math.abs(rounded).toLocaleString("tr-TR")} ft/min`
            );
        }


        return "0 ft/min";
    }


    /*
     * WINDY LIFECYCLE
     */
    export const onopen =
        (_params: unknown) => {};


    /*
     * PLUGIN KAPANIRSA TEMÄ°ZLE
     */
    onDestroy(() => {

        if (
            timer
        ) {

            clearInterval(
                timer
            );


            timer =
                null;
        }


        stopAnimation();


        if (
            aircraftMarker
        ) {

            aircraftMarker.remove();


            aircraftMarker =
                null;
        }


        if (
            trailLine
        ) {

            trailLine.remove();


            trailLine =
                null;
        }


        trailPoints =
            [];
    });

</script>


<style lang="less">

    .tracker {

        padding:
            12px;
    }


    .search {

        display:
            flex;

        gap:
            8px;
    }


    input {

        flex:
            1;

        min-width:
            0;

        padding:
            10px;

        border-radius:
            6px;

        border:
            1px solid #888;

        text-transform:
            uppercase;
    }


    button {

        padding:
            9px 12px;

        border:
            0;

        border-radius:
            6px;

        font-weight:
            600;

        cursor:
            pointer;

        white-space:
            nowrap;
    }


    button:disabled {

        opacity:
            .65;

        cursor:
            default;
    }


    .error {

        margin-top:
            8px;

        padding:
            8px;

        background:
            rgba(
                190,
                30,
                30,
                .22
            );

        border-radius:
            6px;
    }


    .card {

        margin-top:
            9px;

        padding:
            10px;

        background:
            rgba(
                255,
                255,
                255,
                .08
            );

        border-radius:
            8px;
    }


    .title {

        display:
            flex;

        justify-content:
            space-between;

        align-items:
            center;

        gap:
            8px;

        margin-bottom:
            5px;
    }


    .registration {

        font-size:
            11px;

        opacity:
            .75;
    }


    .row {

        display:
            flex;

        justify-content:
            space-between;

        gap:
            12px;

        padding:
            3px 0;
    }


    .live {

        margin-top:
            7px;

        font-size:
            11px;

        font-weight:
            600;
    }


    /*
     * LEAFLET'Ä°N KENDÄ°
     * MARKER ARKA PLANINI KALDIR.
     */
    :global(.aircraft-marker-wrapper) {

        background:
            transparent !important;

        border:
            none !important;
    }


    /*
     * MARKER ALANI
     */
    :global(.aircraft-map-marker) {

        position:
            relative;

        width:
            120px;

        height:
            100px;

        pointer-events:
            none;
    }


    /*
     * AKINCI.PNG
     *
     * GerÃ§ek koordinat tam olarak
     * uÃ§aÄŸÄ±n merkezidir.
     */
    :global(.aircraft-plane-image) {

        position:
            absolute;

        left:
            60px;

        top:
            50px;

        width:
            82px;

        height:
            auto;

        transform-origin:
            50% 50%;

        pointer-events:
            none;

        user-select:
            none;

        filter:
            drop-shadow(
                0 2px 3px
                rgba(
                    0,
                    0,
                    0,
                    .8
                )
            );
    }


    /*
     * CALLSIGN
     */
    :global(.aircraft-label) {

        position:
            absolute;

        top:
            82px;

        left:
            60px;

        transform:
            translateX(-50%);

        padding:
            2px 6px;

        border-radius:
            4px;

        background:
            rgba(
                0,
                0,
                0,
                .85
            );

        color:
            white;

        font-size:
            11px;

        font-weight:
            700;

        white-space:
            nowrap;
    }


    /*
     * MOBÄ°L
     */
    @media (
        max-width: 700px
    ) {

        .plugin__mobile-header {

            display:
                none !important;
        }


        .plugin__content {

            padding:
                0 !important;
        }


        .tracker {

            padding:
                8px 10px;

            max-height:
                205px;

            overflow-y:
                auto;
        }


        input,
        button {

            height:
                38px;

            box-sizing:
                border-box;
        }


        .card {

            padding:
                7px 9px;
        }


        .row {

            font-size:
                12px;

            padding:
                2px 0;
        }


        .title {

            margin-bottom:
                3px;
        }


        .live {

            margin-top:
                4px;
        }
    }

</style>