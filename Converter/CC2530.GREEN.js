
//                  Smartes Gewächshaus CC2530
//
//                  - 1x DS18B20 für die Bodentemperatur
//                  - 1x DHT22 Innenraummessung
//                  - 2x Soil-Sensoren
//                  - 2x Reed
//                  - 2x Relais


const zigbeeHerdsmanConverters = require('zigbee-herdsman-converters');
const zigbeeHerdsmanUtils = require('zigbee-herdsman-converters/lib/utils');

const exposes = zigbeeHerdsmanConverters['exposes'] || require("zigbee-herdsman-converters/lib/exposes");
const ea = exposes.access;
const e = exposes.presets;
const modernExposes = (e.hasOwnProperty('illuminance_lux'))? false: true;

const fz = zigbeeHerdsmanConverters.fromZigbeeConverters || zigbeeHerdsmanConverters.fromZigbee;
const tz = zigbeeHerdsmanConverters.toZigbeeConverters || zigbeeHerdsmanConverters.toZigbee;

const tzlocal = {};
const fzlocal = {};

const ptvo_switch = (zigbeeHerdsmanConverters.findByModel)?zigbeeHerdsmanConverters.findByModel('ptvo.switch'):zigbeeHerdsmanConverters.findByDevice({modelID: 'ptvo.switch'});

fz.legacy = ptvo_switch.meta.tuyaThermostatPreset;

fz.ptvo_on_off = {
  cluster: 'genOnOff',
  type: ['attributeReport', 'readResponse'],
  convert: (model, msg, publish, options, meta) => {
      if (msg.data.hasOwnProperty('onOff')) {
          const channel = msg.endpoint.ID;
          const endpointName = zigbeeHerdsmanUtils.postfixWithEndpointName('_', msg, model, meta).replace('__','');
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

//                  Copied from fromZigbee.js
//                  The standard converter does not append the endpoint number

fz.ptvo_humidity = {
  cluster: 'msRelativeHumidity',
  type: ['attributeReport', 'readResponse'],
  options: [exposes.options.precision('humidity'), exposes.options.calibration('humidity')],
  convert: (model, msg, publish, options, meta) => {
      const humidity = parseFloat(msg.data['measuredValue']) / 100.0;

//                  https://github.com/Koenkk/zigbee2mqtt/issues/798
//                  Sometimes the sensor publishes non-realistic vales, it should only publish message
//                  in the 0 - 100 range, don't produce messages beyond these values.

      if (humidity >= 0 && humidity <= 100) {
          const property = zigbeeHerdsmanUtils.postfixWithEndpointName('humidity', msg, model, meta);
          return {[property]: zigbeeHerdsmanUtils.calibrateAndPrecisionRoundOptions(humidity, options, 'humidity')};
      }
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

//                  fzlocal

fzlocal.ptvo_switch_analog_input= {
    cluster: 'genAnalogInput',
    type: ['attributeReport', 'readResponse'],
    convert: (model, msg, publish, options, meta) => {
        const payload = {};
        const channel = msg.endpoint.ID;
        
        let name = '';
        if (model.propnames !== undefined && model.propnames(model)[channel].length > 0) 
            name = zigbeeHerdsmanUtils.postfixWithEndpointName(model.propnames(model)[channel], msg, model, meta);
        else 
            name = zigbeeHerdsmanUtils.postfixWithEndpointName('_', msg, model, meta).replace('__', '');

        const endpoint = msg.endpoint;
        payload[name] = zigbeeHerdsmanUtils.precisionRound(msg.data['presentValue'], 3);
        
        const cluster = 'genLevelCtrl';
        if (endpoint && (endpoint.supportsInputCluster(cluster) || endpoint.supportsOutputCluster(cluster))) {
            payload[zigbeeHerdsmanUtils.postfixWithEndpointName('brightness', msg, model, meta)] = msg.data['presentValue'];
        } else if (msg.data.description !== undefined) {
            const data1 = msg.data['description'];
            if (data1) {
                const data2 = data1.split(',');
                const devid = data2[1];
                const unit = data2[0];
                if (devid) {
                     payload[zigbeeHerdsmanUtils.postfixWithEndpointName('device', msg, model, meta)] = devid;
//                  payload['device_' + name] = devid;
                }

                const valRaw = msg.data['presentValue'];
                if (unit) {
                    let val = zigbeeHerdsmanUtils.precisionRound(valRaw, 1);

                    const nameLookup = {
                        C: 'temperature',
                        '%': 'humidity',
                        m: 'altitude',
                        Pa: 'pressure',
                        ppm: 'quality',
                        psize: 'particle_size',
                        V: 'voltage',
                        A: 'current',
                        Wh: 'energy',
                        W: 'power',
                        Hz: 'frequency',
                        pf: 'power_factor',
                        lx: 'illuminance',
                    };

                    let nameAlt = '';
                    if (unit === 'A' || unit === 'pf') {
                        if (valRaw < 1) {
                            val = zigbeeHerdsmanUtils.precisionRound(valRaw, 3);
                        }
                    }
                    if (unit.startsWith('mcpm') || unit.startsWith('ncpm')) {
                        const num = unit.substr(4, 1);
                        nameAlt = num === 'A' ? unit.substr(0, 4) + '10' : unit;
                        val = zigbeeHerdsmanUtils.precisionRound(valRaw, 2);
                    } else {
                        nameAlt = nameLookup[unit];
                    }
                    if (nameAlt === undefined) {
                        const valueIndex = parseInt(unit, 10);
                        if (!isNaN(valueIndex)) {
                            nameAlt = 'val' + unit;
                        }
                    }

                    if (nameAlt !== undefined) {
                        payload[zigbeeHerdsmanUtils.postfixWithEndpointName(nameAlt, msg, model, meta)] = val;
//                  payload[nameAlt + '_' + name] = val;
                    }
                }
            }
        }
        
        return payload;
    },
}

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

//
//                  Angepasst werden muessen die EP Namen in den Exposes im Device (Mark A)
//                  sowie die Zuordnung EPName zu EP ID (Mark B) Die müssen zusammen passen, incl. Gross/Kleinschreibung
//


const device = {
    zigbeeModel: ['CC2530.GREEN'],
    model: 'CC2530.GREEN',
    vendor: 'inventwo',
    description: '[Greenhouse](https://github.com/inventwo/custom-zigbee)',
    fromZigbee: [fz.ignore_basic_report, fzlocal.ptvo_switch_analog_input, fz.temperature, fz.ptvo_humidity, fz.ptvo_on_off, fz.ptvo_multistate_action, fz.ptvo_on_off_config,],
    toZigbee: [tz.ptvo_switch_trigger, tz.on_off, tz.ptvo_on_off_config,],

//                  MARK A

    exposes: [
      e.temperature().withEndpoint('Boden').withDescription('Bodentemperatur L1'),
      e.temperature().withEndpoint('Innenraum').withDescription('Lufttemperatur L2'),
      e.humidity().withEndpoint('Innenraum').withDescription('Luftfeuchte L2'),
      exposes.numeric('soil_moisture', ea.STATE).withDescription('Bodenfeuchte L3').withUnit('µS/cm').withEndpoint('Links'),
      exposes.numeric('soil_moisture', ea.STATE).withDescription('Bodenfeuchte L4').withUnit('µS/cm').withEndpoint('Rechts'),
      e.contact().withEndpoint('Eingang').withDescription('Eingangskontakt L5'),
      e.contact().withEndpoint('Fenster').withDescription('Fensterkontakt L6'),
      e.switch().withEndpoint('Licht'),
      e.switch().withEndpoint('Heizung'),
      ...ptvo_on_off_config_exposes('Eingang'),
      ...ptvo_on_off_config_exposes('Fenster'),
    ],
    meta: {
        multiEndpoint: true,
        binaryEndpoints: {'Eingang': 'contact', 'Fenster': 'contact', },
    },

//                  MARK B

   endpoint: (device) => {
        return {
            Erdreich: 1, Innenraum: 2, Links: 3, Rechts: 4, Eingang: 5, Fenster: 6, Licht: 7, Heizung: 8,
        };
    },

    propnames: (id) => { 
        return { 
            1: '', 
            2: '', 
            3: 'soil_moisture', 
            4: 'soil_moisture', 
            5: '', 
            6: '', 
            7: '', 
            8: '', 
        };
    },

    icon: '/device_icons/custom/GREENHOUSE.png',
    
    configure: async (device, coordinatorEndpoint, logger) => {
      const endpoint = device.getEndpoint(1);
      await endpoint.read('genBasic', ['modelId', 'swBuildId', 'powerSource']);
    },

};

module.exports = device;
