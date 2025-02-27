//                  GREENHOUSE CC2530
//
//                  - 1x DS18B20 Bodentemperatur
//                  - 3x Soil-Sensoren

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
                }

                const valRaw = msg.data['presentValue'];
                if (unit) {
                    let val = zigbeeHerdsmanUtils.precisionRound(valRaw, 3);

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
                    }
                }
            }
        }
        
        return payload;
    },
}

const device = {
    zigbeeModel: ['CC.VEGATABLE'],
    model: 'CC.VEGATABLE',
    vendor: 'inventwo',
    description: '[CC2530 Greenhouse](https://github.com/inventwo/custom-zigbee)',
    fromZigbee: [fz.ignore_basic_report, fz.temperature, fzlocal.ptvo_switch_analog_input,],
    toZigbee: [tz.ptvo_switch_trigger,],
    exposes: [
      e.temperature().withEndpoint('Erdreich').withDescription('Bodentemperatur L1'),
      exposes.numeric('soil_moisture', ea.STATE).withDescription('Bodenfeuchte L2').withUnit('µS/cm').withEndpoint('Links'),
      exposes.numeric('soil_moisture', ea.STATE).withDescription('Bodenfeuchte L3').withUnit('µS/cm').withEndpoint('Mitte'),
      exposes.numeric('soil_moisture', ea.STATE).withDescription('Bodenfeuchte L4').withUnit('µS/cm').withEndpoint('Rechts'),
],
    meta: {
        multiEndpoint: true,
        
    },
    endpoint: (device) => {
        return {
            Erdreich: 1, Links: 2, Mitte: 3, Rechts: 4,
        };
    },

    propnames: (id) => { 
        return { 
            1: '', 
            2: 'soil_moisture', 
            3: 'soil_moisture', 
            4: 'soil_moisture', 
        };
    },

    icon: '/device_icons/custom/PLANT.png',    

    configure: async (device, coordinatorEndpoint, logger) => {
      const endpoint = device.getEndpoint(1);
      await endpoint.read('genBasic', ['modelId', 'swBuildId', 'powerSource']);
    },

};

module.exports = device;
