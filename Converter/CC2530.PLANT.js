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


const switchTypesList = {
    'switch': 0x00,
    'single click': 0x01,
    'multi-click': 0x02,
    'reset to defaults': 0xff,
};

const switchActionsList = {
    on: 0x00,
    off: 0x01,
    toggle: 0x02,
};

const inputLinkList = {
    no: 0x00,
    yes: 0x01,
};

const bindCommandList = {
    'on/off': 0x00,
    'toggle': 0x01,
    'change level up': 0x02,
    'change level down': 0x03,
    'change level up with off': 0x04,
    'change level down with off': 0x05,
    'recall scene 0': 0x06,
    'recall scene 1': 0x07,
    'recall scene 2': 0x08,
    'recall scene 3': 0x09,
    'recall scene 4': 0x0A,
    'recall scene 5': 0x0B,
    'dimmer': 0x0C,
    'dimmer (hue)': 0x0D,
    'dimmer (saturation)': 0x0E,
    'dimmer (color temperature)': 0x0F,
    'intruder alarm systems (ias)': 0x20,
};

function getSortedList(source) {
    const keysSorted = [];
    for (const key in source) {
        keysSorted.push([key, source[key]]);
    }

    keysSorted.sort(function(a, b) {
        return a[1] - b[1];
    });

    const result = [];
    keysSorted.forEach((item) => {
        result.push(item[0]);
    });
    return result;
}

function getListValueByKey(source, value) {
    const intVal = parseInt(value, 10);
    return source.hasOwnProperty(value) ? source[value] : intVal;
}

const getKey = (object, value) => {
    for (const key in object) {
        if (object[key] == value) return key;
    }
};

tz.ptvo_on_off_config = {
    key: ['switch_type', 'switch_actions', 'link_to_output', 'bind_command'],
    convertGet: async (entity, key, meta) => {
        await entity.read('genOnOffSwitchCfg', ['switchType', 'switchActions', 0x4001, 0x4002]);
    },
    convertSet: async (entity, key, value, meta) => {
        let payload;
        let data;
        switch (key) {
        case 'switch_type':
            data = getListValueByKey(switchTypesList, value);
            payload = {switchType: data};
            break;
        case 'switch_actions':
            data = getListValueByKey(switchActionsList, value);
            payload = {switchActions: data};
            break;
        case 'link_to_output':
            data = getListValueByKey(inputLinkList, value);
            payload = {0x4001: {value: data, type: 32 /* uint8 */}};
            break;
        case 'bind_command':
            data = getListValueByKey(bindCommandList, value);
            payload = {0x4002: {value: data, type: 32 /* uint8 */}};
            break;
        }
        await entity.write('genOnOffSwitchCfg', payload);
    },
};

fz.ptvo_on_off_config = {
    cluster: 'genOnOffSwitchCfg',
    type: ['readResponse', 'attributeReport'],
    convert: (model, msg, publish, options, meta) => {
        const channel = getKey(model.endpoint(msg.device), msg.endpoint.ID);
        const {switchActions, switchType} = msg.data;
        const inputLink = msg.data[0x4001];
        const bindCommand = msg.data[0x4002];
        return {
            [`switch_type_${channel}`]: getKey(switchTypesList, switchType),
            [`switch_actions_${channel}`]: getKey(switchActionsList, switchActions),
            [`link_to_output_${channel}`]: getKey(inputLinkList, inputLink),
            [`bind_command_${channel}`]: getKey(bindCommandList, bindCommand),
        };
    },
};

function ptvo_on_off_config_exposes(epName) {
    const features = [];
    features.push(exposes.enum('switch_type', exposes.access.ALL,
        getSortedList(switchTypesList)).withEndpoint(epName));
    features.push(exposes.enum('switch_actions', exposes.access.ALL,
        getSortedList(switchActionsList)).withEndpoint(epName));
    features.push(exposes.enum('link_to_output', exposes.access.ALL,
        getSortedList(inputLinkList)).withEndpoint(epName));
    features.push(exposes.enum('bind_command', exposes.access.ALL,
        getSortedList(bindCommandList)).withEndpoint(epName));
    return features;
}




const device = {
    zigbeeModel: ['CC2530.PLANT'],
    model: 'CC2530.PLANT',
    vendor: 'inventwo',
    description: '[Greenhouse](https://github.com/inventwo/custom-zigbee)',
    fromZigbee: [fz.ignore_basic_report, fz.ptvo_switch_analog_input, fz.temperature, fz.ptvo_humidity, fz.ptvo_on_off, fz.ptvo_multistate_action, fz.ptvo_on_off_config,],
    toZigbee: [tz.ptvo_switch_trigger, tz.on_off, tz.ptvo_on_off_config,],
    exposes: [e.temperature().withEndpoint('l1').withDescription('Bodentemperatur L1'),
      e.temperature().withEndpoint('l2').withDescription('Lufttemperatur L2'),
      e.humidity().withEndpoint('l2').withDescription('Luftfeuchte L2'),
      exposes.numeric('l3', ea.STATE).withDescription('Bodenfeuchte L3').withUnit('µS/cm'),
      exposes.numeric('l4', ea.STATE).withDescription('Bodenfeuchte L4').withUnit('µS/cm'),
      e.contact().withEndpoint('l5').withDescription('Kontakt Eingang L5'),
      e.contact().withEndpoint('l6').withDescription('Kontakt Fenster L6'),
      e.switch().withEndpoint('l7').withDescription('Relais Licht L7'),
      e.switch().withEndpoint('l8').withDescription('Relais Heizung L8'),
      ...ptvo_on_off_config_exposes('l5'),
      ...ptvo_on_off_config_exposes('l6'),
],
    meta: {
        multiEndpoint: true,
        binaryEndpoints: {'l5': 'contact', 'l6': 'contact', }, 
    },
    endpoint: (device) => {
        return {
            l1: 1, l2: 2, l3: 3, l4: 4, l5: 5, l6: 6, l7: 7, l8: 8,
        };
    },
    icon: 'data:image/png;base64,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',
    configure: async (device, coordinatorEndpoint, logger) => {
      const endpoint = device.getEndpoint(1);
      await endpoint.read('genBasic', ['modelId', 'swBuildId', 'powerSource']);
    },

};

module.exports = device;

