import { Id } from '../id/id.js';
import { Reservation } from './reservation.js';

describe('Reservation.create', () => {
  const item = Id.generate();

  it('valid input builds a Reservation with generated id, generated token, and stamped createdAt', () => {
    const result = Reservation.create({ item, name: 'Alex' });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const reservation = result.value;
    expect(reservation.id).toBeTruthy();
    expect(reservation.item).toBe(item);
    expect(reservation.name).toBe('Alex');
    expect(reservation.token).toBeTruthy();
    expect(reservation.createdAt).toBeInstanceOf(Date);
  });

  it('rejects an empty name', () => {
    const result = Reservation.create({ item, name: '' });
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
  });
});

describe('Reservation round-trip', () => {
  const item = Id.generate();

  it('Reservation.from(Reservation.plain(reservation)) deep-equals the original', () => {
    const result = Reservation.create({ item, name: 'Alex' });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const reservation = result.value;
    expect(Reservation.from(Reservation.plain(reservation))).toEqual(
      reservation,
    );
  });
});
