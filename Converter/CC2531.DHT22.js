const zigbeeHerdsmanConverters = require('zigbee-herdsman-converters');
const zigbeeHerdsmanUtils = require('zigbee-herdsman-converters/lib/utils');


const exposes = zigbeeHerdsmanConverters['exposes'] || require("zigbee-herdsman-converters/lib/exposes");
const ea = exposes.access;
const e = exposes.presets;
const modernExposes = (e.hasOwnProperty('illuminance_lux'))? false: true;

const fz = zigbeeHerdsmanConverters.fromZigbeeConverters || zigbeeHerdsmanConverters.fromZigbee;
const tz = zigbeeHerdsmanConverters.toZigbeeConverters || zigbeeHerdsmanConverters.toZigbee;

const ptvo_switch = (zigbeeHerdsmanConverters.findByModel)?zigbeeHerdsmanConverters.findByModel('ptvo.switch'):zigbeeHerdsmanConverters.findByDevice({modelID: 'ptvo.switch'});
fz.legacy = ptvo_switch.meta.tuyaThermostatPreset;
fz.ptvo_on_off = {
  cluster: 'genOnOff',
  type: ['attributeReport', 'readResponse'],
  convert: (model, msg, publish, options, meta) => {
      if (msg.data.hasOwnProperty('onOff')) {
          const channel = msg.endpoint.ID;
          const endpointName = `l${channel}`;
          const binaryEndpoint = model.meta && model.meta.binaryEndpoints && model.meta.binaryEndpoints[endpointName];
          const prefix = (binaryEndpoint) ? model.meta.binaryEndpoints[endpointName] : 'state';
          const property = zigbeeHerdsmanUtils.postfixWithEndpointName(prefix, msg, model, meta);
	  if (binaryEndpoint) {
            return {[property]: msg.data['onOff'] === 1};
          }
          return {[property]: msg.data['onOff'] === 1 ? 'ON' : 'OFF'};
      }
  },
};


// Copied from fromZigbee.js
// The standard converter does not append the endpoint number

fz.ptvo_humidity = {
  cluster: 'msRelativeHumidity',
  type: ['attributeReport', 'readResponse'],
  options: [exposes.options.precision('humidity'), exposes.options.calibration('humidity')],
  convert: (model, msg, publish, options, meta) => {
      const humidity = parseFloat(msg.data['measuredValue']) / 100.0;

      // https://github.com/Koenkk/zigbee2mqtt/issues/798
      // Sometimes the sensor publishes non-realistic vales, it should only publish message
      // in the 0 - 100 range, don't produce messages beyond these values.
      if (humidity >= 0 && humidity <= 100) {
          const property = zigbeeHerdsmanUtils.postfixWithEndpointName('humidity', msg, model, meta);
          return {[property]: zigbeeHerdsmanUtils.calibrateAndPrecisionRoundOptions(humidity, options, 'humidity')};
      }
  },
};

fz.ptvo_pressure = {
  cluster: 'msPressureMeasurement',
  type: ['attributeReport', 'readResponse'],
  options: [exposes.options.precision('pressure'), exposes.options.calibration('pressure')],
  convert: (model, msg, publish, options, meta) => {
      let pressure = 0;
      if (msg.data.hasOwnProperty('scaledValue')) {
          const scale = msg.endpoint.getClusterAttributeValue('msPressureMeasurement', 'scale');
          pressure = msg.data['scaledValue'] / Math.pow(10, scale) / 100.0; // convert to hPa
      } else {
          pressure = parseFloat(msg.data['measuredValue']);
      }
      const property = zigbeeHerdsmanUtils.postfixWithEndpointName('pressure', msg, model, meta);
      return {[property]: zigbeeHerdsmanUtils.calibrateAndPrecisionRoundOptions(pressure, options, 'pressure')};
  },
};


//
//                  Angepasst werden muessen die EP Namen in den Exposes im Device (Mark A)
//                  sowie die Zuordnung EPName zu EP ID (Mark B) Die müssen zusammen passen, incl. Gross/Kleinschreibung
//


const device = {
    zigbeeModel: ['CC2531.DHT22'],
    model: 'CC2531.DHT22',
    vendor: 'inventwo',
    description: '[CC2531 w. DHT22 Sensor](https://github.com/inventwo/custom-zigbee)',
    fromZigbee: [fz.ignore_basic_report, fz.temperature, fz.ptvo_humidity,],
    toZigbee: [tz.ptvo_switch_trigger,],
	
    // MARK A
	
    exposes: [
      e.temperature().withEndpoint('Werkstatt').withDescription('Innentemperatur'),
      e.humidity().withEndpoint('Werkstatt').withDescription('Innenfeuchtigkeit'),
      e.temperature().withEndpoint('Aussenbereich').withDescription('Aussentemperatur'),
      e.humidity().withEndpoint('Aussenbereich').withDescription('Aussenfeuchtigkeit'),
      ],
    meta: {
        multiEndpoint: true,

    },
	
    // MARK B
	
    endpoint: (device) => {
        return {
            Werkstatt: 1, Aussenbereich: 2,
        };
    },
    
    icon: '/device_icons/custom/DHT22.png',

    configure: async (device, coordinatorEndpoint, logger) => {
      const endpoint = device.getEndpoint(1);
      await endpoint.read('genBasic', ['modelId', 'swBuildId', 'powerSource']);
    },

};

module.exports = device;
