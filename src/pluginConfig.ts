import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-aircraft-tracker-free',
    version: '1.0.4',
    icon: '✈',
    title: 'Uçak Takip Sistemi',
    description: 'ADS-B verileriyle canlı uçak takip eklentisi.',
    author: 'Ozkan Kilic',
    repository: 'https://github.com/ozkankilic5225/windy-aircraft-tracker-free',
    desktopUI: 'rhpane',
    mobileUI: 'small',
    routerPath: '/aircraft-tracker-free',
};

export default config;