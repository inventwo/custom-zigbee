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

fz.ptvo_humidity = {
  cluster: 'msRelativeHumidity',
  type: ['attributeReport', 'readResponse'],
  options: [exposes.options.precision('humidity'), exposes.options.calibration('humidity')],
  convert: (model, msg, publish, options, meta) => {
      const humidity = parseFloat(msg.data['measuredValue']) / 100.0;

      if (humidity >= 0 && humidity <= 100) {
          const property = zigbeeHerdsmanUtils.postfixWithEndpointName('humidity', msg, model, meta);
          return {[property]: zigbeeHerdsmanUtils.calibrateAndPrecisionRoundOptions(humidity, options, 'humidity')};
      }
  },
};

//
// Angepasst werden muessen die EP Namen in den Exposes im Device (Mark A)
// sowie die Zuordnung EPName zu EP ID (Mark B) Die müssen zusammen passen, incl. Gross/Kleinschreibung
//

const device = {
    zigbeeModel: ['CC.DHT22'],
    model: 'CC.DHT22',
    vendor: 'inventwo',
    description: '[CC265R1 w. DHT22](https://github.com/inventwo/custom-zigbee)',
    fromZigbee: [fz.ignore_basic_report, fz.temperature, fz.ptvo_humidity,],
    toZigbee: [tz.ptvo_switch_trigger,],
// MARK A
    exposes: [
        e.temperature().withEndpoint('Aussenbereich').withDescription('Aussentemperatur'),
        e.humidity().withEndpoint('Aussenbereich').withDescription('Aussenfeuchtigkeit'),
        e.temperature().withEndpoint('Werkstatt').withDescription('Innentemperatur'),
        e.humidity().withEndpoint('Werkstatt').withDescription('Innenfeuchtigkeit'),
        e.temperature().withEndpoint('Toilette').withDescription('Innentemperatur'),
        e.humidity().withEndpoint('Toilette').withDescription('Innenfeuchtigkeit'),
//        e.temperature().withEndpoint('Schuppen').withDescription('Innentemperatur'),
//        e.humidity().withEndpoint('Schuppen').withDescription('Innenfeuchtigkeit'),
],
    meta: {
        multiEndpoint: true,
        
    },
// MARK B    
    endpoint: (device) => {
        return {
            Aussenbereich: 1, Werkstatt: 2, Toilette: 3,
        };
    },

    icon: '/device_icons/custom/DHT22.png',

    configure: async (device, coordinatorEndpoint, logger) => {
      const endpoint = device.getEndpoint(1);
      await endpoint.read('genBasic', ['modelId', 'swBuildId', 'powerSource']);
    },

};

module.exports = device;
