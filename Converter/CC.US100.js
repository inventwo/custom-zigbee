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

const fzlocal = {
    local_analog_switch: {
      cluster: 'genAnalogInput',
      type: ['attributeReport', 'readResponse'],
      convert: (model, msg, publish, options, meta) => {
          const payload = {};
          const channel = msg.endpoint.ID;
          const name = `state`;
          const endpoint = msg.endpoint;
  
          payload['state'] = precisionRound(msg.data['presentValue'], 3);
          if (msg.data['presentValue'] < 100) payload['mode'] = 'belegt'; else payload['mode'] = 'frei';
  
          const cluster = 'genLevelCtrl';
          if (endpoint && (endpoint.supportsInputCluster(cluster) || endpoint.supportsOutputCluster(cluster))) {
              payload['brightness_' + name] = msg.data['presentValue'];
          } else if (msg.data.description !== undefined) {
              const data1 = msg.data['description'];
              if (data1) {
                  const data2 = data1.split(',');
                  const devid = data2[1];
                  const unit = data2[0];
                  if (devid) {
                      payload['device_' + name] = devid;
                  }
   
                  const valRaw = msg.data['presentValue'];
                  if (unit) {
                      let val = precisionRound(valRaw, 1);
   
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
                              val = precisionRound(valRaw, 3);
                          }
                      }
                      if (unit.startsWith('mcpm') || unit.startsWith('ncpm')) {
                          const num = unit.substr(4, 1);
                          nameAlt = num === 'A' ? unit.substr(0, 4) + '10' : unit;
                          val = precisionRound(valRaw, 2);
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
                          payload[nameAlt + '_' + name] = val;
                      }
                  }
              }
          }
          return payload;
      },
    },
   
    
  }

//
// Angepasst werden muessen die EP Namen in den Exposes im Device (Mark A)
// sowie die Zuordnung EPName zu EP ID (Mark B) Die müssen zusammen passen, incl. Gross/Kleinschreibung
//

const device = {
    zigbeeModel: ['CC.US100'],
    model: 'CC.US100',
    vendor: 'inventwo',
    description: '[CC2531 w. US-100 Sensor](https://github.com/inventwo/custom-zigbee)',
    fromZigbee: [fz.ignore_basic_report, fz.ptvo_switch_uart, fzlocal.local_analog_switch,],
    toZigbee: [tz.ptvo_switch_trigger, tz.ptvo_switch_uart,],
// MARK A   
    exposes: [
        exposes.numeric('state', ea.STATE).withDescription('Innenraummessung').withUnit('mm'),
        exposes.binary('mode', ea.STATE, 'belegt', 'frei').withDescription('Belegung der Station'),
],
    meta: {
        multiEndpoint: true,
        
    },
// MARK B  
    endpoint: (device) => {
        return {
            state: 1,
        };
    },

    icon: '/device_icons/custom/US100.png',

    configure: async (device, coordinatorEndpoint, logger) => {
      const endpoint = device.getEndpoint(1);
      await endpoint.read('genBasic', ['modelId', 'swBuildId', 'powerSource']);
    },

};

module.exports = device;
