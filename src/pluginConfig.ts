import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-aircraft-tracker-free',
    version: '1.0.1',
    icon: '✈',
    title: 'Ãœcretsiz UÃ§ak Takip',
    description: 'AÃ§Ä±k ADS-B verileriyle canlÄ± uÃ§ak takip eklentisi.',
    author: 'Ozkan Kilic',
    repository: 'https://github.com/windycom/windy-plugin-template',
    desktopUI: 'rhpane',
    mobileUI: 'small',
    routerPath: '/aircraft-tracker-free',
    private: true,
};

export default config;
