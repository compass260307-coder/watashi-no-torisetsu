declare module "lunar-javascript" {
  interface EightChar {
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getDayGan(): string;
    getDayZhi(): string;
    getDayGanIndex(): number;
  }

  interface Lunar {
    getEightChar(): EightChar;
  }

  interface SolarDate {
    getLunar(): Lunar;
  }

  export const Solar: {
    fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): SolarDate;
  };
}
