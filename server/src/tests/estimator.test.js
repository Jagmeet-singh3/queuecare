const {
  calculateRollingAverageConsultationTime,
  calculateEstimatedWait
} = require('../queue/waitEstimator');

describe('Wait-Time Estimator Algorithm Unit Tests', () => {
  test('should fallback to default consultation duration when no history exists', () => {
    const avg = calculateRollingAverageConsultationTime([], 12);
    expect(avg).toBe(12);

    const avgNull = calculateRollingAverageConsultationTime(null, 10);
    expect(avgNull).toBe(10);
  });

  test('should calculate exact rolling mean of up to 10 completed consultations', () => {
    const durations = [8, 10, 12, 10, 8]; // sum = 48, count = 5 -> avg = 9.6
    const avg = calculateRollingAverageConsultationTime(durations, 10);
    expect(avg).toBe(9.6);
  });

  test('should limit rolling window to the last 10 entries', () => {
    // 15 items: first 5 are 100 mins (old), last 10 are all 8 mins
    const oldItems = [100, 100, 100, 100, 100];
    const recentItems = [8, 8, 8, 8, 8, 8, 8, 8, 8, 8];
    const avg = calculateRollingAverageConsultationTime([...oldItems, ...recentItems], 10, 10);
    expect(avg).toBe(8.0);
  });

  test('should calculate estimated wait: patients ahead * average duration', () => {
    // 4 patients ahead, 9.5 mins per consult -> 4 * 9.5 = 38 mins
    const wait = calculateEstimatedWait(4, 9.5);
    expect(wait.estimatedWaitMinutes).toBe(38);
    expect(wait.formattedWaitText).toBe('38 min');
    expect(wait.isPaused).toBe(false);
  });

  test('should return 0 minutes with "You are next!" when 0 patients ahead', () => {
    const wait = calculateEstimatedWait(0, 10);
    expect(wait.estimatedWaitMinutes).toBe(0);
    expect(wait.formattedWaitText).toBe('You are next!');
    expect(wait.isPaused).toBe(false);
  });

  test('should indicate queue paused state and freeze wait estimate', () => {
    const wait = calculateEstimatedWait(3, 10, true);
    expect(wait.isPaused).toBe(true);
    expect(wait.estimatedWaitMinutes).toBe(30);
    expect(wait.formattedWaitText).toContain('Queue Paused');
  });
});
