declare module "@novnc/novnc" {
  export default class RFB extends EventTarget {
    constructor(target: HTMLElement, url: string);
    viewOnly: boolean;
    focusOnClick: boolean;
    scaleViewport: boolean;
    background: string;
    qualityLevel: number;
    disconnect(): void;
    sendKey(keysym: number, code: string | null, down?: boolean): void;
  }
}
