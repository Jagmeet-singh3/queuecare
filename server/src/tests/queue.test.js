const { PatientQueue } = require('../queue/PatientQueue');

describe('PatientQueue Data Structure Unit Tests', () => {
  let queue;

  beforeEach(() => {
    queue = new PatientQueue(1);
  });

  test('should initialize an empty queue', () => {
    expect(queue.isEmpty()).toBe(true);
    expect(queue.size()).toBe(0);
    expect(queue.peek()).toBeNull();
    expect(queue.dequeue()).toBeNull();
  });

  test('should enqueue patients in FIFO order with O(1) complexity', () => {
    queue.enqueue({ appointmentId: 101, tokenDisplay: 'A01', patientName: 'Alice' });
    queue.enqueue({ appointmentId: 102, tokenDisplay: 'A02', patientName: 'Bob' });
    queue.enqueue({ appointmentId: 103, tokenDisplay: 'A03', patientName: 'Charlie' });

    expect(queue.size()).toBe(3);
    expect(queue.isEmpty()).toBe(false);
    expect(queue.peek().tokenDisplay).toBe('A01');
    expect(queue.getPosition(101)).toBe(1);
    expect(queue.getPosition(102)).toBe(2);
    expect(queue.getPosition(103)).toBe(3);
  });

  test('should dequeue elements in exact FIFO order', () => {
    queue.enqueue({ appointmentId: 1, tokenDisplay: 'A01' });
    queue.enqueue({ appointmentId: 2, tokenDisplay: 'A02' });

    const first = queue.dequeue();
    expect(first.tokenDisplay).toBe('A01');
    expect(queue.size()).toBe(1);
    expect(queue.peek().tokenDisplay).toBe('A02');

    const second = queue.dequeue();
    expect(second.tokenDisplay).toBe('A02');
    expect(queue.isEmpty()).toBe(true);
    expect(queue.dequeue()).toBeNull();
  });

  test('should remove specific patient by appointmentId', () => {
    queue.enqueue({ appointmentId: 1, tokenDisplay: 'A01' });
    queue.enqueue({ appointmentId: 2, tokenDisplay: 'A02' });
    queue.enqueue({ appointmentId: 3, tokenDisplay: 'A03' });

    const removed = queue.remove(2);
    expect(removed).not.toBeNull();
    expect(removed.appointmentId).toBe(2);
    expect(queue.size()).toBe(2);

    const arr = queue.toArray();
    expect(arr.map(p => p.tokenDisplay)).toEqual(['A01', 'A03']);
  });

  test('should correctly handle skip operation (move back by 3 positions)', () => {
    // Queue: A01 (head), A02, A03, A04, A05, A06
    for (let i = 1; i <= 6; i++) {
      queue.enqueue({ appointmentId: i, tokenDisplay: `A0${i}` });
    }

    // Skip A01 by 3 positions:
    // Should move past A02, A03, A04 -> New order: A02, A03, A04, A01, A05, A06
    const result = queue.skip('A01', 3);
    expect(result).not.toBeNull();
    expect(result.skipCount).toBe(1);
    expect(result.newPosition).toBe(4);

    const order = queue.toArray().map(p => p.tokenDisplay);
    expect(order).toEqual(['A02', 'A03', 'A04', 'A01', 'A05', 'A06']);
  });

  test('should push to tail if fewer than 3 patients remain behind skipped patient', () => {
    queue.enqueue({ appointmentId: 1, tokenDisplay: 'A01' });
    queue.enqueue({ appointmentId: 2, tokenDisplay: 'A02' });
    queue.enqueue({ appointmentId: 3, tokenDisplay: 'A03' });

    // A01 skip by 3 in a queue of 3 will land at tail (position 3)
    const result = queue.skip('A01', 3);
    expect(result.newPosition).toBe(3);

    const order = queue.toArray().map(p => p.tokenDisplay);
    expect(order).toEqual(['A02', 'A03', 'A01']);
  });

  test('should handle edge cases: skipping in single-element queue', () => {
    queue.enqueue({ appointmentId: 1, tokenDisplay: 'A01' });
    const result = queue.skip('A01', 3);
    expect(result.newPosition).toBe(1);
    expect(result.skipCount).toBe(1);
    expect(queue.size()).toBe(1);
  });

  test('should handle non-existent patient in remove and skip gracefully', () => {
    queue.enqueue({ appointmentId: 1, tokenDisplay: 'A01' });
    expect(queue.remove(999)).toBeNull();
    expect(queue.skip(999, 3)).toBeNull();
    expect(queue.getPosition(999)).toBe(-1);
    expect(queue.size()).toBe(1);
  });
});
