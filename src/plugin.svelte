<div class="plugin__mobile-header">✈️ Ücretsiz Uçak Takip</div>

<section class="plugin__content">
    <div class="tracker">
        <div class="search">
            <input
                bind:value={callsign}
                placeholder="Örn. THY46P"
                on:keydown={(e) => e.key === "Enter" && startTracking()}
            />

            <button on:click={startTracking} disabled={loading}>
                {loading ? "Aranıyor..." : "Takip Et"}
            </button>
        </div>

        {#if error}
            <div class="error">{error}</div>
        {/if}

        {#if aircraft}
            <div class="card">
                <strong>✈️ {aircraft.callsign}</strong>

                <div>
                    <span>İrtifa</span>
                    <b>{formatNumber(aircraft.altitude_ft, " ft")}</b>
                </div>

                <div>
                    <span>Yer hızı</span>
                    <b>{formatNumber(aircraft.ground_speed_kt, " kt")}</b>
                </div>

                <div>
                    <span>Yön</span>
                    <b>{formatNumber(aircraft.track_deg, "°")}</b>
                </div>

                <div>
                    <span>Dikey hız</span>
                    <b>{formatVerticalSpeed(aircraft.vertical_speed_fpm)}</b>
                </div>

                <div class="live">
                    ● ADSB.lol canlı • 5 sn
                </div>
            </div>
        {/if}
    </div>
</section>

<script lang="ts">
    import { map } from "@windy/map";
    import { onDestroy } from "svelte";

    const API_BASE = "https://api.adsb.lol/v2/callsign/";

    // Her 5 saniyede bir yeni ADS-B verisi al.
    const UPDATE_INTERVAL = 5000;

    let callsign = "";
    let aircraft: any = null;
    let error = "";
    let loading = false;

    let timer:
        ReturnType<typeof setInterval> |
        null = null;

    let aircraftMarker:
        L.Marker |
        null = null;

    let firstPosition = true;


    function cleanCallsign(value: string) {
        return value
            .trim()
            .toUpperCase();
    }


    function escapeHtml(value: string) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /*
     * ADSB.lol verisini plugin'in kullanacağı
     * basit veri yapısına dönüştür.
     */
    function normalize(raw: any) {
        return {
            callsign:
                String(raw.flight || "").trim(),

            lat:
                Number(raw.lat),

            lon:
                Number(raw.lon),

            altitude_ft:
                typeof raw.alt_baro === "number"
                    ? raw.alt_baro
                    : (
                        typeof raw.alt_geom === "number"
                            ? raw.alt_geom
                            : null
                    ),

            ground_speed_kt:
                typeof raw.gs === "number"
                    ? raw.gs
                    : null,

            track_deg:
                typeof raw.track === "number"
                    ? raw.track
                    : null,

            vertical_speed_fpm:
                typeof raw.baro_rate === "number"
                    ? raw.baro_rate
                    : (
                        typeof raw.geom_rate === "number"
                            ? raw.geom_rate
                            : null
                    ),
        };
    }


    /*
     * Haritadaki uçak ikonu.
     * Uçak track değerine göre döner.
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

                    <div
                        class="aircraft-plane"
                        style="
                            transform:
                            rotate(${heading}deg)
                        "
                    >
                        ✈
                    </div>

                    <div class="aircraft-label">
                        ${escapeHtml(label)}
                    </div>

                </div>
            `,

            iconSize:
                [110, 58],

            iconAnchor:
                [55, 24]
        });
    }


    /*
     * Uçağı Windy haritasında göster.
     */
    function showAircraftOnMap(data: any) {

        if (
            !Number.isFinite(data.lat) ||
            !Number.isFinite(data.lon)
        ) {
            return;
        }

        const label =
            data.callsign ||
            callsign;

        const track =
            Number(data.track_deg);


        /*
         * İlk veri geldiğinde marker oluştur.
         */
        if (!aircraftMarker) {

            aircraftMarker =
                L.marker(
                    [data.lat, data.lon],
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
             * İlk bulmada haritayı
             * uçağın üzerine götür.
             */
            if (firstPosition) {

                map.setView(
                    [data.lat, data.lon],
                    8
                );

                firstPosition =
                    false;
            }

            return;
        }


        /*
         * Sonraki 5 saniyelik verilerde
         * konumu ve yönü güncelle.
         */
        aircraftMarker.setLatLng(
            [data.lat, data.lon]
        );

        aircraftMarker.setIcon(
            createAircraftIcon(
                track,
                label
            )
        );
    }


    /*
     * ADSB.lol'dan canlı uçak verisini al.
     */
    async function fetchAircraft() {

        const wanted =
            cleanCallsign(callsign);

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


            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }


            const data =
                await response.json();


            const raw =
                Array.isArray(data.ac)
                    ? data.ac[0]
                    : null;


            if (!raw) {

                error =
                    `${wanted} şu anda ADSB.lol verisinde bulunamadı.`;

                return;
            }


            const next =
                normalize(raw);


            if (
                !Number.isFinite(next.lat) ||
                !Number.isFinite(next.lon)
            ) {

                error =
                    `${wanted} bulundu fakat güncel konumu yok.`;

                return;
            }


            aircraft =
                next;

            error =
                "";

            showAircraftOnMap(next);

        }

        catch (e) {

            console.error(e);

            error =
                "Canlı ADS-B verisi alınamadı.";
        }
    }


    /*
     * Takibi başlat.
     */
    async function startTracking() {

        const wanted =
            cleanCallsign(callsign);


        if (!wanted) {

            error =
                "Lütfen bir callsign yaz.";

            return;
        }


        callsign =
            wanted;

        loading =
            true;


        /*
         * Eski sorgu zamanlayıcısını temizle.
         */
        if (timer) {

            clearInterval(timer);

            timer =
                null;
        }


        /*
         * Önceki uçağı temizle.
         */
        if (aircraftMarker) {

            aircraftMarker.remove();

            aircraftMarker =
                null;
        }


        firstPosition =
            true;


        /*
         * İlk veriyi hemen al.
         */
        await fetchAircraft();


        loading =
            false;


        /*
         * Sonra her 5 saniyede bir güncelle.
         */
        timer =
            setInterval(
                fetchAircraft,
                UPDATE_INTERVAL
            );
    }


    function formatNumber(
        value: any,
        suffix: string
    ) {

        const n =
            Number(value);


        return Number.isFinite(n)

            ? `${Math.round(n).toLocaleString("tr-TR")}${suffix}`

            : "—";
    }


    function formatVerticalSpeed(
        value: any
    ) {

        const n =
            Number(value);


        if (!Number.isFinite(n)) {
            return "—";
        }


        if (n > 0) {

            return `↑ ${Math.round(n).toLocaleString("tr-TR")} ft/min`;

        }


        if (n < 0) {

            return `↓ ${Math.abs(Math.round(n)).toLocaleString("tr-TR")} ft/min`;

        }


        return "0 ft/min";
    }


    export const onopen =
        (_params: unknown) => {};


    /*
     * Plugin kapanınca sorguyu
     * ve haritadaki markerı temizle.
     */
    onDestroy(() => {

        if (timer) {
            clearInterval(timer);
        }


        if (aircraftMarker) {
            aircraftMarker.remove();
        }

    });

</script>


<style lang="less">

    .tracker {
        padding: 12px;
    }


    .search {
        display: flex;
        gap: 8px;
    }


    input {
        flex: 1;
        min-width: 0;
        padding: 10px;

        border-radius: 6px;
        border: 1px solid #888;

        text-transform: uppercase;
    }


    button {
        padding: 9px 12px;

        border: 0;
        border-radius: 6px;

        font-weight: 600;
        cursor: pointer;

        white-space: nowrap;
    }


    .error {
        margin-top: 8px;
        padding: 8px;

        background:
            rgba(190, 30, 30, .22);

        border-radius: 6px;
    }


    .card {
        margin-top: 9px;
        padding: 10px;

        background:
            rgba(255, 255, 255, .08);

        border-radius: 8px;
    }


    .card > div:not(.live) {
        display: flex;

        justify-content:
            space-between;

        gap: 12px;

        padding: 3px 0;
    }


    .live {
        margin-top: 6px;

        font-size: 11px;
        font-weight: 600;
    }


    :global(
        .aircraft-marker-wrapper
    ) {
        background:
            transparent !important;

        border:
            none !important;
    }


    :global(
        .aircraft-map-marker
    ) {
        position: relative;

        width: 110px;
        height: 58px;

        pointer-events: none;
    }


    :global(
        .aircraft-plane
    ) {
        position: absolute;

        left: 37px;
        top: 0;

        width: 36px;
        height: 36px;

        font-size: 34px;
        line-height: 36px;

        text-align: center;

        transform-origin:
            50% 50%;

        color: white;

        text-shadow:
            0 1px 3px #000;
    }


    :global(
        .aircraft-label
    ) {
        position: absolute;

        top: 38px;
        left: 50%;

        transform:
            translateX(-50%);

        padding:
            2px 6px;

        border-radius:
            4px;

        background:
            rgba(0, 0, 0, .82);

        color: white;

        font-size: 11px;
        font-weight: 700;

        white-space: nowrap;
    }


    /*
     * Mobilde Windy haritasının ve
     * katman kontrollerinin kullanılabilmesi
     * için kompakt görünüm.
     */
    @media (max-width: 700px) {

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
                185px;

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


        .card > div:not(.live) {
            font-size:
                12px;

            padding:
                2px 0;
        }

    }

</style>