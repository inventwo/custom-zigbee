//temperature reading is working so leave it as tuya handling
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const modernExtend = require('zigbee-herdsman-converters/lib/modernExtend');

const {deviceEndpoints, onOff} = require('zigbee-herdsman-converters/lib/modernExtend');
const exposes = zigbeeHerdsmanConverters['exposes'] || require("zigbee-herdsman-converters/lib/exposes");
const ea = exposes.access;
const e = exposes.presets;

const definition = {
    zigbeeModel: ['TS000F'], // The model ID from the device.
    model: 'TS000F',
    vendor: 'MHCOZY',
    description: '1-Kanal-Relais mit DS18B20',
    fingerprint: [{modelID: 'TS000F', manufacturerName: '_TZ3218_7fiyo3kv'}], // This helps z2m identify the device
    fromZigbee: [tuya.fz.datapoints], // Define converters that are used to convert from Zigbee messages to MQTT messages.
    toZigbee: [], // Define converters that are used to convert from MQTT messages to Zigbee messages.
    extend: [
        deviceEndpoints({"endpoints":{"0":0,"1":1}}),
        onOff({"powerOnBehavior":false,"endpointNames":["1"]}),
        //tuya.modernExtend.dpTemperature({dp: 0x66, scale: 10})
        ],
    exposes: [
        e.temperature().withEndpoint('1').withDescription('Whatever '),
    ], // Defines what capabilities (like temperature or on/off) are exposed to MQTT
    meta: {
        multiEndpoint: true,
        tuyaDatapoints: [
            [102, 'temperature', tuya.valueConverter.divideBy10]
        ]
    },
    
    configure: async (device, coordinatorEndpoint, logger) => {
        const endpoint = device.getEndpoint(1);
        await endpoint.bind('genOnOff', coordinatorEndpoint);
        // More configurations can be added here
    },
    
    icon: '/device_icons/custom/DS18B20.png',

};

module.exports = definition;
