2// Converter for PTVO Custom Zigbee by inventwo

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
    zigbeeModel: ['CC.VEGETABLE'],
    model: 'CC.VEGETABLE',
    vendor: 'inventwo',
    description: '[CC2530 Plants](https://github.com/inventwo/custom-zigbee)',
    fromZigbee: [fz.ignore_basic_report, fzlocal.ptvo_switch_analog_input,],
    toZigbee: [tz.ptvo_switch_trigger,],
    exposes: [
      exposes.numeric('soil_moisture', ea.STATE).withDescription('Hochbeet L1').withUnit('µS/cm').withEndpoint('Hochbeet'),
      exposes.numeric('soil_moisture', ea.STATE).withDescription('Saatbeet L2').withUnit('µS/cm').withEndpoint('Saatbeet'),
],
    meta: {
        multiEndpoint: true,
        
    },
    endpoint: (device) => {
        return {
            Hochbeet: 1, Saatbeet: 2,
        };
    },

    propnames: (id) => { 
        return { 
            1: 'soil_moisture', 
            2: 'soil_moisture', 
        };
    },

    icon: '/device_icons/custom/PLANT.png',    

    configure: async (device, coordinatorEndpoint, logger) => {
      const endpoint = device.getEndpoint(1);
      await endpoint.read('genBasic', ['modelId', 'swBuildId', 'powerSource']);
    },

};

module.exports = device;
