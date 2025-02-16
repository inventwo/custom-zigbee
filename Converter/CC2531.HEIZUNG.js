const zigbeeHerdsmanConverters = require('zigbee-herdsman-converters');
const zigbeeHerdsmanUtils = require('zigbee-herdsman-converters/lib/utils');


const exposes = zigbeeHerdsmanConverters['exposes'] || require("zigbee-herdsman-converters/lib/exposes");
const ea = exposes.access;
const e = exposes.presets;
const modernExposes = (e.hasOwnProperty('illuminance_lux'))? false: true;

const fz = zigbeeHerdsmanConverters.fromZigbeeConverters || zigbeeHerdsmanConverters.fromZigbee;
const tz = zigbeeHerdsmanConverters.toZigbeeConverters || zigbeeHerdsmanConverters.toZigbee;

const ptvo_switch = (zigbeeHerdsmanConverters.findByModel)?zigbeeHerdsmanConverters.findByModel('ptvo.switch'):zigbeeHerdsmanConverters.findByDevice({modelID: 'ptvo.switch'});

const precisionRound = zigbeeHerdsmanUtils.precisionRound;

const device = {
    zigbeeModel: ['CC2531.HEIZUNG'],
    model: 'CC2531.HEIZUNG',
    vendor: 'inventwo',
    description: '[CC2531 w. DS18B20 Sensor](https://github.com/inventwo/custom-zigbee)',
    fromZigbee: [fz.ignore_basic_report, fz.temperature],
    toZigbee: [tz.ptvo_switch_trigger,],
    exposes: [
        e.temperature().withEndpoint('Vorlauf').withDescription('Vorlauftemperatur'),
        e.temperature().withEndpoint('Rücklauf').withDescription('Rücklauftemperatur'),
],
    meta: {
        multiEndpoint: true,
        
    },
    endpoint: (device) => {
        return {
            Vorlauf: 1, Rücklauf: 2,
        };
    },
   
    icon: '/device_icons/custom/DS18B20.png',

    configure: async (device, coordinatorEndpoint, logger) => {
      const endpoint = device.getEndpoint(1);
      await endpoint.read('genBasic', ['modelId', 'swBuildId', 'powerSource']);
    },

};

module.exports = device;
