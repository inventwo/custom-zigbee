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

const precisionRound = zigbeeHerdsmanUtils.precisionRound;
const fzlocal = {
    local_analog_switch: {
      cluster: 'genAnalogInput',
      type: ['attributeReport', 'readResponse'],
      convert: (model, msg, publish, options, meta) => {
          const payload = {};
          const channel = msg.endpoint.ID;
          const mapping = {
            1: 'temperature_Vorlauf',
            2: 'temperature_Rücklauf'
          }

          if(mapping[channel] === undefined) return payload

          payload[mapping[channel]] = precisionRound(msg.data['presentValue'], 1)

          return payload


      }
    }
}  

const device = {
    zigbeeModel: ['CC2531.DS18B20'],
    model: 'CC2531.DS18B20',
    vendor: 'inventwo',
    description: '[CC2531 w. DS18B20 Sensor](https://github.com/inventwo/custom-zigbee)',
    fromZigbee: [fz.ignore_basic_report, fz.ptvo_switch_analog_input, fzlocal.local_analog_switch],
    toZigbee: [tz.ptvo_switch_trigger,],
    exposes: [
        exposes.numeric('temperature', ea.STATE).withUnit('°C').withEndpoint('Vorlauf').withDescription('Vorlauftemperatur'),
        exposes.numeric('temperature', ea.STATE).withUnit('°C').withEndpoint('Rücklauf').withDescription('Rücklauftemperatur'),
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
