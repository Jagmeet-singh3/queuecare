/**
 * QueueCare: Hospital/Clinic Waiting-Time Management
 * Simulation Script: Walk-In (No Information) vs. QueueCare Virtual Queue System
 *
 * Simulates 50 patients arriving at an outpatient clinic and compares:
 * 1. Traditional Walk-In Scenario (Blind waiting in crowded waiting room)
 * 2. QueueCare Virtual Queue System (Remote waiting with just-in-time arrival)
 *
 * Run:
 *   node scripts/simulate.js
 */

function runSimulation(numPatients = 50) {
  console.log('\n================================================================================');
  console.log(`🏥 QUEUECARE CLINICAL SIMULATION: 50 PATIENTS BENCHMARK`);
  console.log(`Comparing Traditional Walk-In (Blind Waiting) vs. QueueCare Virtual Queue`);
  console.log('================================================================================\n');

  // Pseudo-random Gaussian helper for realistic medical appointment pacing
  function randomGaussian(mean, stdev) {
    let u1 = 0, u2 = 0;
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdev + mean;
  }

  // Clinic parameters
  const clinicStartTime = 9.0 * 60; // 09:00 AM (in minutes from midnight = 540)
  const defaultConsultMean = 9.5;   // Average 9.5 mins per consultation
  const defaultConsultStd = 2.5;    // Standard deviation

  // Generate 50 patient arrivals (staggered with peak between 09:30 and 11:00)
  const patients = [];
  let currentArrivalTime = 8.5 * 60; // Arrivals start at 08:30 AM (510 mins)

  for (let i = 1; i <= numPatients; i++) {
    // Arrival spacing: tighter during peak (minutes 570 - 660, i.e., 09:30 - 11:00)
    let arrivalGap;
    if (currentArrivalTime >= 570 && currentArrivalTime <= 660) {
      arrivalGap = Math.max(1, randomGaussian(3.5, 1.5)); // Peak inflow every 2-4 mins
    } else {
      arrivalGap = Math.max(2, randomGaussian(6.0, 2.0)); // Off-peak every 4-8 mins
    }
    currentArrivalTime += arrivalGap;

    const consultDuration = Math.max(5.0, Math.min(18.0, randomGaussian(defaultConsultMean, defaultConsultStd)));

    patients.push({
      id: i,
      token: `A${String(i).padStart(2, '0')}`,
      arrivalTime: currentArrivalTime,
      consultDuration: consultDuration,
      // Results to be populated:
      serviceStartTime: 0,
      serviceEndTime: 0,
      totalWaitMinutes: 0,
      walkinLobbyMinutes: 0,
      queuecareLobbyMinutes: 0
    });
  }

  // Simulate Queue Execution (FIFO Single-Doctor OPD)
  let doctorAvailableAt = clinicStartTime;

  for (let i = 0; i < patients.length; i++) {
    const p = patients[i];

    // Doctor cannot start before patient arrives or before doctor finishes previous patient
    p.serviceStartTime = Math.max(p.arrivalTime, doctorAvailableAt);
    p.serviceEndTime = p.serviceStartTime + p.consultDuration;
    doctorAvailableAt = p.serviceEndTime;

    // Total wait time from arrival/booking until doctor consultation begins
    p.totalWaitMinutes = p.serviceStartTime - p.arrivalTime;

    // SCENARIO 1: Traditional Walk-In (No information)
    // Patient arrives at clinic and sits in physical waiting room the entire time
    p.walkinLobbyMinutes = p.totalWaitMinutes;

    // SCENARIO 2: QueueCare Virtual Queue System
    // Patient tracks queue remotely on their phone.
    // They are notified to arrive at the clinic 10-12 minutes prior to their expected call.
    // If their total wait is less than 12 mins, they wait their actual time.
    // Otherwise, they arrive "just in time", spending only ~10-12 minutes physically in the lobby.
    const justInTimeThreshold = 12.0; // Arrival buffer in minutes
    p.queuecareLobbyMinutes = Math.min(p.totalWaitMinutes, justInTimeThreshold);
  }

  // Compute Aggregates
  let sumTotalWait = 0;
  let sumWalkinLobby = 0;
  let sumQueueCareLobby = 0;

  for (const p of patients) {
    sumTotalWait += p.totalWaitMinutes;
    sumWalkinLobby += p.walkinLobbyMinutes;
    sumQueueCareLobby += p.queuecareLobbyMinutes;
  }

  const avgTotalWait = (sumTotalWait / numPatients).toFixed(1);
  const avgWalkinLobby = (sumWalkinLobby / numPatients).toFixed(1);
  const avgQueueCareLobby = (sumQueueCareLobby / numPatients).toFixed(1);

  const physicalReductionPct = (
    ((sumWalkinLobby - sumQueueCareLobby) / sumWalkinLobby) * 100
  ).toFixed(1);

  // Peak Waiting Room Congestion Analysis (Simulate concurrent occupancy over time)
  let maxWalkinOccupancy = 0;
  let maxQueueCareOccupancy = 0;

  // Sample minute by minute from 08:30 (510m) to 14:00 (840m)
  for (let m = 510; m <= 840; m += 5) {
    let walkinCount = 0;
    let queuecareCount = 0;

    for (const p of patients) {
      // In walk-in: present from arrivalTime to serviceStartTime
      if (m >= p.arrivalTime && m < p.serviceStartTime) {
        walkinCount++;
      }
      // In QueueCare: present only during the 12m buffer prior to serviceStartTime
      const qcArrival = Math.max(p.arrivalTime, p.serviceStartTime - 12.0);
      if (m >= qcArrival && m < p.serviceStartTime) {
        queuecareCount++;
      }
    }

    if (walkinCount > maxWalkinOccupancy) maxWalkinOccupancy = walkinCount;
    if (queuecareCount > maxQueueCareOccupancy) maxQueueCareOccupancy = queuecareCount;
  }

  // Display Output Table
  console.log(`Sample of Simulated Patient Cohort (First 10 of ${numPatients}):`);
  console.log('--------------------------------------------------------------------------------');
  console.log(`Token | Total Wait | Walk-in Lobby Time | QueueCare Lobby Time | Wait Location`);
  console.log('--------------------------------------------------------------------------------');
  for (let i = 0; i < 10; i++) {
    const p = patients[i];
    const loc = p.totalWaitMinutes > 15 ? 'Waited Remotely / Café' : 'Direct OPD Arrival';
    console.log(
      `${p.token.padEnd(5)} | ` +
      `${p.totalWaitMinutes.toFixed(1).padStart(7)} min | ` +
      `${p.walkinLobbyMinutes.toFixed(1).padStart(15)} min | ` +
      `${p.queuecareLobbyMinutes.toFixed(1).padStart(17)} min | ` +
      `${loc}`
    );
  }
  console.log('--------------------------------------------------------------------------------');

  console.log('\n================================================================================');
  console.log('📊 SIMULATION OUTCOMES & SIGNIFICANT RESULTS FOR COLLEGE PRESENTATION');
  console.log('================================================================================');
  console.log(`1. Total Cohort Size:                    ${numPatients} Outpatient Consultations`);
  console.log(`2. Average Total Waiting Time:           ${avgTotalWait} minutes`);
  console.log(`3. Traditional Physical Lobby Wait:      ${avgWalkinLobby} minutes / patient`);
  console.log(`4. QueueCare Physical Lobby Wait:        ${avgQueueCareLobby} minutes / patient`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`🎯 PHYSICAL WAITING-ROOM TIME REDUCTION: ${physicalReductionPct}%`);
  console.log(`🏢 Peak Waiting Room Density (Walk-in):  ${maxWalkinOccupancy} patients crowded in lobby`);
  console.log(`🌿 Peak Waiting Room Density (QueueCare): ${maxQueueCareOccupancy} patients in lobby`);
  console.log(`📉 Waiting Room Congestion Drop:         ${(((maxWalkinOccupancy - maxQueueCareOccupancy) / maxWalkinOccupancy) * 100).toFixed(1)}% reduction in physical crowding`);
  console.log('================================================================================\n');

  return {
    numPatients,
    avgTotalWait,
    avgWalkinLobby,
    avgQueueCareLobby,
    physicalReductionPct,
    maxWalkinOccupancy,
    maxQueueCareOccupancy
  };
}

if (require.main === module) {
  runSimulation(50);
}

module.exports = runSimulation;
