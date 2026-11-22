/**
 * QueueCare: Hospital/Clinic Waiting-Time Management
 * Algorithm: Dynamic Wait-Time Estimator
 *
 * FORMULA:
 * Estimated Wait (minutes) = Patients Ahead * Rolling Average Consultation Time
 *
 * SPECIFICATION:
 * - Rolling mean calculated from the last 10 completed consultations for the given doctor on the given date (or historical).
 * - Falls back to doctor's configured default consultation duration (default 10 mins) if fewer than 1 consultation is completed.
 * - If queue is paused, wait-time projection is marked as "Paused / Frozen".
 */

/**
 * Calculates rolling average consultation duration from an array of durations (in minutes).
 * @param {Array<number>} recentConsultationDurations Array of durations in minutes
 * @param {number} defaultDuration Fallback duration in minutes
 * @param {number} maxWindow Maximum recent consultations to consider (default 10)
 * @returns {number} Average consultation duration in minutes, rounded to 1 decimal place
 */
function calculateRollingAverageConsultationTime(recentConsultationDurations, defaultDuration = 10, maxWindow = 10) {
  if (!recentConsultationDurations || recentConsultationDurations.length === 0) {
    return Number(defaultDuration) || 10;
  }

  // Take up to the last maxWindow items
  const windowSlice = recentConsultationDurations.slice(-maxWindow);
  const validDurations = windowSlice.filter(d => typeof d === 'number' && !isNaN(d) && d > 0);

  if (validDurations.length === 0) {
    return Number(defaultDuration) || 10;
  }

  const sum = validDurations.reduce((acc, curr) => acc + curr, 0);
  const avg = sum / validDurations.length;
  return Math.round(avg * 10) / 10; // Round to 1 decimal place (e.g. 8.4)
}

/**
 * Calculates estimated wait time in minutes for a patient.
 * @param {number} patientsAhead Number of patients ahead in the active queue
 * @param {number} avgConsultTime Doctor's average consultation duration (mins)
 * @param {boolean} isPaused Whether the doctor's queue is paused
 * @returns {{ estimatedWaitMinutes: number, formattedWaitText: string, isPaused: boolean }}
 */
function calculateEstimatedWait(patientsAhead, avgConsultTime, isPaused = false) {
  const ahead = Math.max(0, parseInt(patientsAhead, 10) || 0);
  const consultTime = Math.max(1, parseFloat(avgConsultTime) || 10);

  if (isPaused) {
    const rawWait = Math.round(ahead * consultTime);
    return {
      estimatedWaitMinutes: rawWait,
      formattedWaitText: `Queue Paused (~${rawWait} min remaining)`,
      isPaused: true
    };
  }

  if (ahead === 0) {
    return {
      estimatedWaitMinutes: 0,
      formattedWaitText: 'You are next!',
      isPaused: false
    };
  }

  const totalWait = Math.round(ahead * consultTime);
  return {
    estimatedWaitMinutes: totalWait,
    formattedWaitText: `${totalWait} min`,
    isPaused: false
  };
}

module.exports = {
  calculateRollingAverageConsultationTime,
  calculateEstimatedWait
};
