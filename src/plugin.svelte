<div class="plugin__mobile-header">
    ✈️ Ücretsiz Uçak Takip
</div>

<section class="plugin__content">
    <div class="tracker">

        <div class="search">
            <input
                bind:value={callsign}
                placeholder="Örn. AKINCI1453"
                on:keydown={(e) => e.key === "Enter" && startTracking()}
            />

            <button
                on:click={startTracking}
                disabled={loading}
            >
                {loading ? "Aranıyor..." : "Takip Et"}
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
                        ✈️ {aircraft.callsign}
                    </strong>

                    {#if aircraft.registration}
                        <span class="registration">
                            {aircraft.registration}
                        </span>
                    {/if}
                </div>

                <div class="row">
                    <span>İrtifa</span>
                    <b>{formatNumber(aircraft.altitude_ft, " ft")}</b>
                </div>

                <div class="row">
                    <span>Yer hızı</span>
                    <b>{formatNumber(aircraft.ground_speed_kt, " kt")}</b>
                </div>

                <div class="row">
                    <span>Yön</span>
                    <b>{formatTrack(aircraft.track_deg)}</b>
                </div>

                <div class="row">
                    <span>Dikey hız</span>
                    <b>{formatVerticalSpeed(aircraft.vertical_speed_fpm)}</b>
                </div>

                {#if aircraft.aircraft_type}
                    <div class="row">
                        <span>Uçak</span>
                        <b>{aircraft.aircraft_type}</b>
                    </div>
                {/if}

                <div class="live">
                    ● CANLI ADS-B • 10 sn
                </div>

            </div>
        {/if}

    </div>
</section>


<script lang="ts">

    import { map } from "@windy/map";
    import { onDestroy } from "svelte";


    /*
     * ÇALIŞAN RENDER PROXY
     */
    const API_BASE =
        "https://windy-aircraft-tracker-free.onrender.com/aircraft?callsign=";


    /*
     * Gerçek ADS-B sorgusu:
     * 10 saniyede bir.
     */
    const UPDATE_INTERVAL =
        10000;


    /*
     * İki gerçek pozisyon arasında
     * akıcı hareket süresi.
     */
    const ANIMATION_DURATION =
        9500;


    /*
     * İz ne sıklıkta güncellensin.
     */
    const TRAIL_UPDATE_INTERVAL =
        200;


    /*
     * PNG artık import edilmiyor.
     * localhost:9999 dist klasörünü
     * servis ediyor.
     */
    const AIRCRAFT_ICON_URL =
        "https://localhost:9999/akinci.png";


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
     * CALLSIGN TEMİZLE
     */
    function cleanCallsign(
        value: string
    ) {

        return value
            .trim()
            .toUpperCase();
    }


    /*
     * HTML GÜVENLİĞİ
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
     * UÇAK İKONU
     *
     * PNG'nin burnu yukarı bakıyor.
     *
     * ADS-B:
     * 0°   = KUZEY
     * 90°  = DOĞU
     * 180° = GÜNEY
     * 270° = BATI
     *
     * Bu yüzden track açısını
     * doğrudan kullanıyoruz.
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
             * Gerçek ADS-B koordinatı
             * marker kutusunun merkezi.
             */
            iconAnchor:
                [60, 50]
        });
    }


    /*
     * AKTİF ANİMASYONU DURDUR
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
     * İZİ OLUŞTUR
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
         * İz uçak ikonunun altında.
         */
        trailLine.bringToBack();
    }


    /*
     * İZE YENİ NOKTA EKLE
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
         * Aynı koordinatı gereksiz
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
     * MARKERI YUMUŞAK HAREKET ETTİR
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
         * Uçak aynı konumdaysa.
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
             * İz de uçakla beraber
             * canlı şekilde uzar.
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
     * HARİTADA UÇAĞI GÖSTER
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
         * İLK POZİSYON
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
             * İz tam burada başlar.
             */
            createTrail(
                data.lat,
                data.lon
            );


            /*
             * Haritayı yalnızca ilk
             * pozisyonda uçağa götür.
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
         * değerine göre PNG'yi döndür.
         */
        aircraftMarker.setIcon(
            createAircraftIcon(
                track,
                label
            )
        );


        /*
         * Yeni gerçek pozisyona
         * yumuşak hareket.
         */
        animateMarker(
            data.lat,
            data.lon
        );
    }


    /*
     * CANLI VERİYİ AL
     */
    async function fetchAircraft() {

        const wanted =
            cleanCallsign(
                callsign
            );


        if (!wanted) {

            error =
                "Lütfen bir callsign yaz.";

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
             * Render hata cevabı.
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
             * Uçak bulunamadı.
             */
            if (
                !data.found
                ||
                !data.aircraft
            ) {

                error =
                    data.message ||
                    `${wanted} şu anda bulunamadı.`;

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
                    `${wanted} bulundu fakat güncel konumu yok.`;

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
                "Canlı ADS-B verisi alınamadı.";
        }
    }


    /*
     * TAKİBİ BAŞLAT
     */
    async function startTracking() {

        const wanted =
            cleanCallsign(
                callsign
            );


        if (!wanted) {

            error =
                "Lütfen bir callsign yaz.";

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
         * Eski uçak.
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
         * İlk veriyi hemen al.
         */
        await fetchAircraft();


        loading =
            false;


        /*
         * 10 saniyede bir
         * gerçek ADS-B güncellemesi.
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

            : "—";
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

            return "—";
        }


        const normalized =
            ((n % 360) + 360) % 360;


        return `${Math.round(normalized)}°`;
    }


    /*
     * DİKEY HIZ
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

            return "—";
        }


        const rounded =
            Math.round(
                n
            );


        if (
            rounded > 0
        ) {

            return (
                `↑ ${rounded.toLocaleString("tr-TR")} ft/min`
            );
        }


        if (
            rounded < 0
        ) {

            return (
                `↓ ${Math.abs(rounded).toLocaleString("tr-TR")} ft/min`
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
     * PLUGIN KAPANIRSA TEMİZLE
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
     * LEAFLET'İN KENDİ
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
     * Gerçek koordinat tam olarak
     * uçağın merkezidir.
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
     * MOBİL
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