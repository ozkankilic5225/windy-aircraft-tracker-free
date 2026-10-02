import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-aircraft-tracker-free',
    version: '1.0.0',
    icon: '✈️',
    title: 'Ücretsiz Uçak Takip',
    description: 'Açık ADS-B verileriyle canlı uçak takip eklentisi.',
    author: 'Ozkan Kilic',
    repository: 'https://github.com/windycom/windy-plugin-template',
    desktopUI: 'rhpane',
    mobileUI: 'small',
    routerPath: '/aircraft-tracker-free',
    private: true,
};

export default config;