import {
  mapTus404ToStandard,
  STANDARD_NOT_FOUND_BODY,
} from './uploads.errors';

describe('mapTus404ToStandard (US-16)', () => {
  it('memetakan 404 tus ke JSON standar', () => {
    expect(
      mapTus404ToStandard({
        status_code: 404,
        body: 'The file for this url was not found\n',
      }),
    ).toEqual({ status_code: 404, body: STANDARD_NOT_FOUND_BODY });
  });

  it('melewatkan galat selain 404 file tus', () => {
    expect(
      mapTus404ToStandard({
        status_code: 409,
        body: 'Upload-Offset conflict\n',
      }),
    ).toBeUndefined();
    expect(
      mapTus404ToStandard({ status_code: 404, body: 'Not found\n' }),
    ).toBeUndefined();
    expect(
      mapTus404ToStandard({ status_code: 500, body: 'x\n' }),
    ).toBeUndefined();
  });
});
