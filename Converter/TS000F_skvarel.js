//temperature reading is working so leave it as tuya handling
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const modernExtend = require('zigbee-herdsman-converters/lib/modernExtend');

const {deviceEndpoints, onOff} = require('zigbee-herdsman-converters/lib/modernExtend');

const definition = {
    zigbeeModel: ['TS000F'], // The model ID from the device.
    model: 'TS000F',
    vendor: 'inventwo',
    description: '1-Kanal-Relais mit DS18B20',
    fingerprint: [{modelID: 'TS000F', manufacturerName: '_TZ3218_7fiyo3kv'}], // This helps z2m identify the device
    fromZigbee: [], // Define converters that are used to convert from Zigbee messages to MQTT messages.
    toZigbee: [], // Define converters that are used to convert from MQTT messages to Zigbee messages.
    
    extend: [
        deviceEndpoints({"endpoints":{"0":0,"1":1}}),
        onOff({"powerOnBehavior":false,"endpointNames":["1"]}),
        tuya.modernExtend.dpTemperature({dp: 0x66, scale: 10})
	],
    
    exposes: [], // Defines what capabilities (like temperature or on/off) are exposed to MQTT
    
    meta: {
        multiEndpoint: true,
    },

    icon: '/device_icons/custom/TS000F.png',

    configure: async (device, coordinatorEndpoint, logger) => {
        const endpoint = device.getEndpoint(1);
        await endpoint.bind('genOnOff', coordinatorEndpoint);
        // More configurations can be added here
    },
};

module.exports = definition;
