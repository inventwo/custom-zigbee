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
          const property = `${prefix}_${endpointName}`;
	  if (binaryEndpoint) {
            return {[property]: msg.data['onOff'] === 1};
          }
          return {[property]: msg.data['onOff'] === 1 ? 'ON' : 'OFF'};
      }
  },
};



const device = {
    zigbeeModel: ['CC.RELAY'],
    model: 'CC.RELAY',
    vendor: 'inventwo',
    description: '[Configurable firmware](https://ptvo.info/zigbee-configurable-firmware-features/)',
    fromZigbee: [fz.ignore_basic_report, fz.ptvo_on_off,],
    toZigbee: [tz.ptvo_switch_trigger, tz.on_off,],
    exposes: [e.switch().withEndpoint('l1'),
      e.switch().withEndpoint('l2'),
      e.switch().withEndpoint('l3'),
      e.switch().withEndpoint('l4'),
],
    meta: {
        multiEndpoint: true,
        
    },
    endpoint: (device) => {
        return {
            l1: 1, l2: 2, l3: 3, l4: 4,
        };
    },
    icon: 'device_icons/custom/INVENTWO.png',
    configure: async (device, coordinatorEndpoint, logger) => {
      const endpoint = device.getEndpoint(1);
      await endpoint.read('genBasic', ['modelId', 'swBuildId', 'powerSource']);
    },

};

module.exports = device;
