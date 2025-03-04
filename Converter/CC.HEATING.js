// Converter for PTVO Custom Zigbee by inventwo

const zigbeeHerdsmanConverters = require('zigbee-herdsman-converters');
const zigbeeHerdsmanUtils = require('zigbee-herdsman-converters/lib/utils');

const exposes = require('zigbee-herdsman-converters/lib/exposes');

const ea = exposes.access;
const e = exposes.presets;

const fz = zigbeeHerdsmanConverters.fromZigbee;
const tz = zigbeeHerdsmanConverters.toZigbee;

const precisionRound = zigbeeHerdsmanUtils.precisionRound;

const tzlocal = {};
const fzlocal = {};

const device = {
    zigbeeModel: ['CC.HEATING'],
    model: 'CC.HEATING',
    vendor: 'inventwo',
    description: '[CC2531 w. DS18B20](https://github.com/inventwo/custom-zigbee)',
    fromZigbee: [fz.ignore_basic_report, fz.temperature,],
    toZigbee: [tz.ptvo_switch_trigger,],
// MARK A    
    exposes: [
        e.temperature().withEndpoint('Vorlauf').withDescription('Vorlauftemperatur'),
        e.temperature().withEndpoint('Rücklauf').withDescription('Rücklauftemperatur'),
],
    meta: {
        multiEndpoint: true,
        
    },
// MARK B      
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
