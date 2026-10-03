import { ukConstituentFor } from './uk-constituent';

/**
 * The split's load-bearing rule: a GB airport or city lands in the right
 * one of the four countries. Border towns and islands are the cases that
 * would go wrong first, so they are the cases pinned here.
 */
describe('ukConstituentFor', () => {
  const cases: [string, number, number, string][] = [
    ['London Heathrow', 51.47, -0.4543, 'GB-ENG'],
    ['Edinburgh', 55.95, -3.3725, 'GB-SCT'],
    ['Cardiff', 51.3967, -3.3433, 'GB-WLS'],
    ['Belfast International', 54.6575, -6.2158, 'GB-NIR'],
    ['Berwick-upon-Tweed (English side of the border)', 55.771, -2.007, 'GB-ENG'],
    ['Eyemouth (Scottish side of the border)', 55.871, -2.09, 'GB-SCT'],
    ['Chester (English side of the Welsh border)', 53.19, -2.89, 'GB-ENG'],
    ['Wrexham (Welsh side of the border)', 53.046, -2.993, 'GB-WLS'],
    ['Derry (Northern Irish side of the border)', 55.0, -7.32, 'GB-NIR'],
    ['Sumburgh, Shetland', 59.8789, -1.2956, 'GB-SCT'],
    ['Stornoway, Outer Hebrides', 58.2156, -6.3311, 'GB-SCT'],
    ['Newport, Isle of Wight', 50.7, -1.29, 'GB-ENG'],
    ['Holyhead, Anglesey', 53.31, -4.63, 'GB-WLS'],
  ];

  it.each(cases)('%s', (_label, lat, lon, expected) => {
    expect(ukConstituentFor(lat, lon)).toBe(expected);
  });

  it('snaps offshore points to the nearest coast', () => {
    // A mile out from Dover, in the Channel: England, not nothing.
    expect(ukConstituentFor(51.11, 1.36)).toBe('GB-ENG');
    // St Mary's, Isles of Scilly: too small for the 50m tier, nearest is Cornwall.
    expect(ukConstituentFor(49.9133, -6.2917)).toBe('GB-ENG');
    // Off the Antrim coast.
    expect(ukConstituentFor(55.25, -6.2)).toBe('GB-NIR');
  });
});
