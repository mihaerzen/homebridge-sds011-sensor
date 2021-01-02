import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  HAP,
  Logging,
  Service,
} from 'homebridge';

import SDS011Wrapper from 'sds011-wrapper';

let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('Sds011SensorPlugin', Sds011SensorPlugin);
};

class Sds011SensorPlugin implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly name: string;
  private readonly airQualityService: Service;
  private pm10: number;
  private pm25: number;
  private readonly pm25Limits: number[];
  private readonly pm10Limits: number[];

  constructor(log: Logging, config: AccessoryConfig) {
    this.log = log;
    this.name = config.name;
    this.pm10 = 0;
    this.pm25 = 0;
    this.pm25Limits = [15, 30, 55, 110];
    this.pm10Limits = [25, 50, 90, 180];

    const {AirQualitySensor} = hap.Service;
    this.airQualityService = new AirQualitySensor(this.name);

    const pullInterval = parseInt(config.interval as string, 10) || 30;
    const portPath = config.portPath || '/dev/ttyUSB0';

    const sds011Sensor = new SDS011Wrapper(portPath);
    sds011Sensor.setReportingMode('active').then(() => sds011Sensor.setWorkingPeriod(pullInterval));

    sds011Sensor.on('measure', (data) => {
      this.pm10 = data.PM10 as number;
      this.pm25 = data['PM2.5'] as number;
    });

    // create handlers for required characteristics
    const {AirQuality} = hap.Characteristic;
    this.airQualityService.getCharacteristic(AirQuality).on('get', this.handleAirQualityGet);
  }

  getAirQuality() {
    const { AirQuality } = hap.Characteristic;

    if (this.pm25 === 0 && this.pm10 === 0) {
      return AirQuality.UNKNOWN;
    }
    if (this.pm25 <= this.pm25Limits[0] && this.pm10 <= this.pm10Limits[0]) {
      return AirQuality.EXCELLENT;
    }
    if (this.pm25 <= this.pm25Limits[1] && this.pm10 <= this.pm10Limits[1]) {
      return AirQuality.GOOD;
    }
    if (this.pm25 <= this.pm25Limits[2] && this.pm10 <= this.pm10Limits[2]) {
      return AirQuality.FAIR;
    }
    if (this.pm25 <= this.pm25Limits[3] && this.pm10 <= this.pm10Limits[3]) {
      return AirQuality.INFERIOR;
    }

    return AirQuality.POOR;
  }

  /**
   * Handle requests to get the current value of the "Current Temperature" characteristic
   */
  handleAirQualityGet = async (callback) => {
    callback(null, this.getAirQuality());
  };

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.airQualityService,
    ];
  }
}
