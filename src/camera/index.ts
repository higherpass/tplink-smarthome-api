/* eslint-disable no-underscore-dangle */
import type { SendOptions } from '../client';
import Device, {
  isCameraSysinfo,
  CommonSysinfo,
  DeviceConstructorOptions,
} from '../device';
import Cloud from '../shared/cloud';
import Emeter, { RealtimeNormalized } from '../shared/emeter';
import Time from '../shared/time';

export interface CameraSysinfoState {
  /**
   * (ms)
   */
  transition_period?: number;
  /**
   * (ms)
   */
  transition?: number;
  on_off?: 0 | 1;
  mode?: string;
  /**
   * 0-360
   */
  hue?: number;
  /**
   * 0-100
   */
  saturation?: number;
  /**
   * 0-100
   */
  brightness?: number;
  /**
   * Kelvin
   */
  color_temp?: number;
  ignore_default?: 0 | 1;
  dft_on_state?: {
    mode?: string;
    hue?: number;
    saturation?: number;
    color_temp?: number;
    brightness?: number;
  };
}

export type CameraSysinfo = CommonSysinfo & {
  mic_type: string; // 'IOT.IPCAMERA';
  mic_mac: string;
  description: string;
  light_state: CameraSysinfoState;
  length?: number;
};

export interface CameraConstructorOptions extends DeviceConstructorOptions {
  sysInfo: CameraSysinfo;
}

interface CameraEvents {
  'emeter-realtime-update': (value: RealtimeNormalized) => void;
  /**
   * @deprecated This will be removed in a future release.
   */
  'polling-error': (error: Error) => void;

  /**
   * Camera was turned on (`sysinfo.light_state.on_off`).
   * @event Bulb#lightstate-sysinfo-on
   * @property {BulbSysinfoLightState} value BulbSysinfoLightState
   */
  'camera-sysinfo-on': (value: CameraSysinfoState) => void;
  /**
   * Bulb was turned off (`sysinfo.light_state.on_off`).
   * @event Bulb#lightstate-sysinfo-off
   * @property {BulbSysinfoLightState} value BulbSysinfoLightState
   */
  'camera-sysinfo-off': (value: CameraSysinfoState) => void;
  /**
   * Bulb's lightstate (`sysinfo.light_state`) was changed.
   * @event Bulb#lightstate-sysinfo-change
   * @property {BulbSysinfoLightState} value BulbSysinfoLightState
   */
  'camera-sysinfo-change': (value: CameraSysinfoState) => void;
  /**
   * Bulb's lightstate (`sysinfo.light_state`) was updated from device. Fired regardless if status was changed.
   * @event Bulb#lightstate-sysinfo-update
   * @property {BulbSysinfoLightState} value BulbSysinfoLightState
   */
  'camera-sysinfo-update': (value: CameraSysinfoState) => void;
}

declare interface Camera {
  on<U extends keyof CameraEvents>(event: U, listener: CameraEvents[U]): this;

  /*
  emit<U extends keyof CameraEvents>(
    event: U,
    ...args: Parameters<CameraEvents[U]>
  ): boolean;
  */
}

/**
 * Camera Device.
 *
 * @fires  Camera#emeter-realtime-update
 * @fires  Camera#lightstate-sysinfo-on
 * @fires  Camera#lightstate-sysinfo-off
 * @fires  Camera#lightstate-sysinfo-change
 * @fires  Camera#lightstate-sysinfo-update
 */
class Camera extends Device {
  emitEventsEnabled = true;

  protected _sysInfo: CameraSysinfo;

  /**
   * @internal
   */
  lastState = { powerOn: false, sysinfoLightState: {} };

  readonly supportsEmeter = true;

  readonly apiModules = {
    system: 'smartlife.iot.common.system',
    cloud: 'smartlife.iot.common.cloud',
    schedule: 'smartlife.iot.common.schedule',
    timesetting: 'smartlife.iot.common.timesetting',
    emeter: 'smartlife.iot.common.emeter',
    netif: 'netif',
    lightingservice: 'smartlife.iot.smartbulb.lightingservice',
  };

  /**
   * @borrows Cloud#getInfo as Bulb.cloud#getInfo
   * @borrows Cloud#bind as Bulb.cloud#bind
   * @borrows Cloud#unbind as Bulb.cloud#unbind
   * @borrows Cloud#getFirmwareList as Bulb.cloud#getFirmwareList
   * @borrows Cloud#setServerUrl as Bulb.cloud#setServerUrl
   */
  readonly cloud: Cloud = new Cloud(this, 'smartlife.iot.common.cloud');

  /**
   * @borrows Emeter#realtime as Bulb.emeter#realtime
   * @borrows Emeter#getRealtime as Bulb.emeter#getRealtime
   * @borrows Emeter#getDayStats as Bulb.emeter#getDayStats
   * @borrows Emeter#getMonthStats as Bulb.emeter#getMonthStats
   * @borrows Emeter#eraseStats as Bulb.emeter#eraseStats
   */
  readonly emeter: Emeter = new Emeter(this, 'smartlife.iot.common.emeter');

  /**
   * @borrows Lighting#lightState as Bulb.lighting#lightState
   * @borrows Lighting#getLightState as Bulb.lighting#getLightState
   * @borrows Lighting#setLightState as Bulb.lighting#setLightState
   */
  // readonly lighting: any;

  /**
   * @borrows Time#getTime as Bulb.time#getTime
   * @borrows Time#getTimezone as Bulb.time#getTimezone
   */
  readonly time: Time = new Time(this, 'smartlife.iot.common.timesetting');

  /**
   * Created by {@link Client} - Do not instantiate directly.
   *
   * See [Device constructor]{@link Device} for common options.
   * @see Device
   * @param options -
   */
  constructor(options: CameraConstructorOptions) {
    super({
      client: options.client,
      _sysInfo: options.sysInfo,
      host: options.host,
      port: options.port,
      logger: options.logger,
      defaultSendOptions: options.defaultSendOptions,
    });

    this.lastState = Object.assign(this.lastState, {
      powerOn: null,
      inUse: null,
    });

    this.apiModules = {
      system: 'smartlife.iot.common.system',
      cloud: 'smartlife.iot.common.cloud',
      schedule: 'smartlife.iot.common.schedule',
      timesetting: 'smartlife.iot.common.timesetting',
      emeter: 'smartlife.iot.common.emeter',
      netif: 'netif',
      lightingservice: 'smartlife.iot.smartbulb.lightingservice',
    };

    this.setSysInfo(options.sysInfo);
    this._sysInfo = options.sysInfo;
  }

  /**
   * Returns cached results from last retrieval of `system.sysinfo`.
   * @returns system.sysinfo
   */
  get sysInfo(): CameraSysinfo {
    return this._sysInfo;
  }

  /**
   * @internal
   */
  setSysInfo(sysInfo: CameraSysinfo): void {
    super.setSysInfo(sysInfo);
    this.emitEvents();
  }

  protected setAliasProperty(alias: string): void {
    this.sysInfo.alias = alias;
  }

  /**
   * Cached value of `sysinfo.[description|dev_name]`.
   */
  get description(): string | undefined {
    return this.sysInfo.description;
  }

  // eslint-disable-next-line class-methods-use-this
  get deviceType(): 'bulb' {
    return 'bulb';
  }

  /**
   * Cached value of `sysinfo.is_dimmable === 1`
   * @returns Cached value of `sysinfo.is_dimmable === 1`
   */
  /*
  get supportsBrightness(): boolean {
    return this.sysInfo.is_dimmable === 1;
  }
  */

  /**
   * Cached value of `sysinfo.is_color === 1`
   * @returns Cached value of `sysinfo.is_color === 1`
   */
  /*
  get supportsColor(): boolean {
    return this.sysInfo.is_color === 1;
  }
  */

  /**
   * Cached value of `sysinfo.is_variable_color_temp === 1`
   * @returns Cached value of `sysinfo.is_variable_color_temp === 1`
   */
  /*
  get supportsColorTemperature(): boolean {
    return this.sysInfo.is_variable_color_temp === 1;
  }
  */

  /**
   * Returns array with min and max supported color temperatures
   * @returns range in kelvin `{min,max}` or `null` if not supported
   */
  /*
  get colorTemperatureRange(): { min: number; max: number } | null {
    if (!this.supportsColorTemperature) return null;

    const { model } = this.sysInfo;

    const k = TPLINK_KELVIN.find(([re]) => re.test(model));
    if (k != null) return { min: k[1], max: k[2] };
    return null;
  }
  */

  /**
   * Gets cameras's SysInfo.
   *
   * Requests `system.sysinfo` from device.
   * @returns parsed JSON response
   */
  async getSysInfo(sendOptions?: SendOptions): Promise<CameraSysinfo> {
    const response = await super.getSysInfo(sendOptions);

    if (!isCameraSysinfo(response)) {
      throw new Error(`Unexpected Response: ${response}`);
    }

    return this.sysInfo;
  }

  /**
   * Requests common Bulb status details in a single request.
   * - `system.get_sysinfo`
   * - `cloud.get_sysinfo`
   * - `emeter.get_realtime`
   * - `schedule.get_next_action`
   *
   * This command is likely to fail on some devices when using UDP transport.
   * This defaults to TCP transport unless overridden in sendOptions.
   *
   * @returns parsed JSON response
   */
  async getInfo(sendOptions?: SendOptions): Promise<Record<string, unknown>> {
    // force TCP unless overridden here
    const sendOptionsForGetInfo: SendOptions =
      sendOptions == null ? {} : sendOptions;
    if (!('transport' in sendOptionsForGetInfo))
      sendOptionsForGetInfo.transport = 'tcp';

    // TODO switch to sendCommand, but need to handle error for devices that don't support emeter
    const response = await this.send(
      `{"${this.apiModules.emeter}":{"get_realtime":{}},"${this.apiModules.lightingservice}":{"get_light_state":{}},"${this.apiModules.schedule}":{"get_next_action":{}},"system":{"get_sysinfo":{}},"${this.apiModules.cloud}":{"get_info":{}}}`,
      sendOptionsForGetInfo
    );
    const data = JSON.parse(response);
    this.setSysInfo(data.system.get_sysinfo);
    this.cloud.info = data[this.apiModules.cloud].get_info;
    this.emeter.setRealtime(data[this.apiModules.emeter].get_realtime);
    return {
      sysInfo: this.sysInfo,
      cloud: { info: this.cloud.info },
      emeter: { realtime: this.emeter.realtime },
    };
  }

  /**
   * Gets on/off state of Bulb.
   *
   * Requests `lightingservice.get_light_state` and returns true if `on_off === 1`.
   * @throws {@link ResponseError}
   */
  /*
  async getPowerState(sendOptions?: SendOptions): Promise<boolean> {
    const lightState = await this.lighting.getLightState(sendOptions);
    return lightState.on_off === 1;
  }
  */

  /**
   * Sets on/off state of Bulb.
   *
   * Sends `lightingservice.transition_light_state` command with on_off `value`.
   * @param  value - true: on, false: off
   * @throws {@link ResponseError}
   */

  async setPowerState(
    // @ts-ignore will be removed.  debugging
    value: boolean,
    // @ts-ignore will be removed.  debugging
    sendOptions?: SendOptions
  ): Promise<boolean> {
    return true; // this.lighting.setLightState({ on_off: value ? 1 : 0 }, sendOptions);
  }

  /**
   * Toggles state of Bulb.
   *
   * Requests `lightingservice.get_light_state` sets the power state to the opposite of `on_off === 1` and returns the new power state.
   * @throws {@link ResponseError}
   */
  /*
  async togglePowerState(sendOptions?: SendOptions): Promise<boolean> {
    const powerState = await this.getPowerState(sendOptions);
    await this.setPowerState(!powerState, sendOptions);
    return !powerState;
  }
  */

  private emitEvents(): void {
    /*
    if (!this.emitEventsEnabled) {
      return;
    }
    */
    /*
    if (sysinfoLightState == null) return;
    const powerOn = sysinfoLightState.on_off === 1;

    if (this.lastState.powerOn !== powerOn) {
      if (powerOn) {
        this.emit('camera-sysinfo-on', sysinfoLightState);
      } else {
        this.emit('camera-sysinfo-off', sysinfoLightState);
      }
    }

    if (!isEqual(this.lastState.sysinfoLightState, sysinfoLightState)) {
      this.emit('camera-sysinfo-change', sysinfoLightState);
    }
    this.emit('camera-sysinfo-update', sysinfoLightState);

    this.lastState.powerOn = powerOn;
    this.lastState.sysinfoLightState = sysinfoLightState;
    */
  }
}

export default Camera;
